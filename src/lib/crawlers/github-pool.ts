import { redisConnection } from "../../workers/queue";

/**
 * GitHub Token Pool Manager
 * 
 * Manages a pool of GitHub API tokens with round-robin rotation and
 * automatic exhaustion tracking based on rate limit headers.
 * 
 * Exhaustion state is stored in Redis for cross-process coordination
 * across multiple PM2/Docker worker instances.
 */
interface TokenState {
  token: string;
  exhaustedUntil: number; // In-memory fallback timestamp in milliseconds
}

class GithubTokenPool {
  private tokens: TokenState[] = [];
  private currentIndex: number = 0;

  constructor() {
    this.initializePool();
  }

  private initializePool() {
    // Priority: GITHUB_TOKENS (comma separated) -> GITHUB_TOKEN (single)
    const tokensStr = process.env.GITHUB_TOKENS;
    const singleToken = process.env.GITHUB_TOKEN;

    if (tokensStr) {
      const parsedTokens = tokensStr.split(',').map(t => t.trim()).filter(Boolean);
      this.tokens = parsedTokens.map(token => ({ token, exhaustedUntil: 0 }));
    } else if (singleToken) {
      this.tokens = [{ token: singleToken, exhaustedUntil: 0 }];
    } else {
      console.warn('[GithubTokenPool] No GITHUB_TOKENS or GITHUB_TOKEN found. API requests will be unauthenticated and severely rate-limited.');
    }

    if (this.tokens.length > 0) {
      console.log(`[GithubTokenPool] Initialized with ${this.tokens.length} token(s).`);
    }
  }

  private getMaskedTokenKey(token: string): string {
    // A safe suffix/hash of the token to use as Redis key without leaking the whole token in Redis
    // We use the last 15 chars because GitHub fine-grained PATs often share the same 15-char prefix.
    return `crawler:token:exhausted:${token.slice(-15)}`;
  }

  /**
   * Retrieves an available token. Checks both local memory and shared Redis state.
   */
  public async getAvailableToken(): Promise<string | null> {
    if (this.tokens.length === 0) return null;

    const now = Date.now();
    let attempts = 0;

    // Fetch exhaustion status of all tokens in parallel from Redis
    const exhaustedKeys = this.tokens.map(t => this.getMaskedTokenKey(t.token));
    let redisResults: (string | null)[] = [];
    try {
      redisResults = await redisConnection.mget(...exhaustedKeys);
    } catch (err) {
      console.warn('[GithubTokenPool] Failed to fetch token exhaustion states from Redis, falling back to local memory.', err);
      redisResults = this.tokens.map(() => null);
    }

    while (attempts < this.tokens.length) {
      const state = this.tokens[this.currentIndex];
      const isExhaustedInRedis = redisResults[this.currentIndex];
      const exhaustedUntilInRedis = isExhaustedInRedis ? parseInt(isExhaustedInRedis) : 0;
      
      const exhaustedUntil = Math.max(state.exhaustedUntil, exhaustedUntilInRedis);

      if (exhaustedUntil < now) {
        // Token is good to use. Rotate index for round-robin.
        const token = state.token;
        this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
        return token;
      }

      // Move to next token
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      attempts++;
    }

    throw new Error('[RateLimitError] [GithubTokenPool] ALL tokens are currently exhausted due to Rate Limit. Please wait.');
  }

  /**
   * Marks a token as exhausted until the specified reset time.
   * Saves to both local memory and shared Redis.
   */
  public async markTokenExhausted(token: string, resetTimeSeconds: string | null): Promise<void> {
    if (!token) return;
    
    // Default to a 60-minute wait if no reset time is provided
    let resetTimestamp = Date.now() + 60 * 60 * 1000; 

    if (resetTimeSeconds) {
      const resetParsed = parseInt(resetTimeSeconds);
      if (!isNaN(resetParsed)) {
        // GitHub sends reset time in seconds
        resetTimestamp = resetParsed * 1000;
        // Add a 5 second buffer to ensure the reset has fully taken effect on GitHub's side
        resetTimestamp += 5000;
      }
    }

    const state = this.tokens.find(t => t.token === token);
    if (state) {
      state.exhaustedUntil = resetTimestamp;
      const resetDate = new Date(resetTimestamp).toLocaleString();
      // Mask token for logging safely (e.g. ghp_abc...xyz)
      const maskedToken = `${token.substring(0, 7)}...${token.slice(-4)}`;
      console.warn(`[GithubTokenPool] Token ${maskedToken} is EXHAUSTED! Locked until: ${resetDate}`);
      
      // Store in Redis with TTL to auto-expire
      const secondsToWait = Math.ceil((resetTimestamp - Date.now()) / 1000);
      if (secondsToWait > 0) {
        try {
          const key = this.getMaskedTokenKey(token);
          await redisConnection.set(key, resetTimestamp.toString(), 'EX', secondsToWait);
        } catch (err) {
          console.warn('[GithubTokenPool] Failed to save token exhaustion state to Redis', err);
        }
      }
    }
  }

  /**
   * Returns the timestamp when the next token becomes available.
   */
  public async getNextAvailableTime(): Promise<number> {
    if (this.tokens.length === 0) return 0;
    
    const exhaustedKeys = this.tokens.map(t => this.getMaskedTokenKey(t.token));
    let redisResults: (string | null)[] = [];
    try {
      redisResults = await redisConnection.mget(...exhaustedKeys);
    } catch (err) {
      console.warn('[GithubTokenPool] Failed to fetch next available time from Redis, using memory.', err);
      redisResults = this.tokens.map(() => null);
    }

    const times = this.tokens.map((state, idx) => {
      const isExhaustedInRedis = redisResults[idx];
      const exhaustedUntilInRedis = isExhaustedInRedis ? parseInt(isExhaustedInRedis) : 0;
      return Math.max(state.exhaustedUntil, exhaustedUntilInRedis);
    });

    return Math.min(...times);
  }

  /**
   * Retrieves rate limit health info for all tokens in parallel.
   */
  public async getTokenHealth(): Promise<TokenHealthInfo[]> {
    if (this.tokens.length === 0) return [];

    const now = Date.now();
    const exhaustedKeys = this.tokens.map(t => this.getMaskedTokenKey(t.token));
    let redisResults: (string | null)[] = [];
    try {
      redisResults = await redisConnection.mget(...exhaustedKeys);
    } catch {
      redisResults = this.tokens.map(() => null);
    }

    const healthPromises = this.tokens.map(async (state, index) => {
      const token = state.token;
      // Mask token safely (e.g. ghp_abc...xyz)
      const maskedToken = token.length > 11 
        ? `${token.substring(0, 7)}...${token.slice(-4)}`
        : 'Invalid Token';
      
      const isExhaustedInRedis = redisResults[index];
      const exhaustedUntilInRedis = isExhaustedInRedis ? parseInt(isExhaustedInRedis) : 0;
      const exhaustedUntil = Math.max(state.exhaustedUntil, exhaustedUntilInRedis);
      
      try {
        const response = await fetch('https://api.github.com/rate_limit', {
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'Authorization': `Bearer ${token}`,
            'User-Agent': 'TiniX-Repo-Trending'
          }
        });

        if (response.status === 401 || (response.status === 403 && !response.headers.get('x-ratelimit-limit'))) {
          return {
            index,
            maskedToken,
            status: 'invalid' as const,
            coreLimit: 0,
            coreRemaining: 0,
            coreResetTime: 0,
            searchLimit: 0,
            searchRemaining: 0,
            searchResetTime: 0,
            graphqlLimit: 0,
            graphqlRemaining: 0,
            graphqlResetTime: 0,
          };
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        const core = data.resources?.core || { limit: 0, remaining: 0, reset: 0 };
        const search = data.resources?.search || { limit: 0, remaining: 0, reset: 0 };
        const graphql = data.resources?.graphql || { limit: 0, remaining: 0, reset: 0 };

        const isExhausted = core.remaining === 0 || graphql.remaining === 0 || exhaustedUntil > now;

        return {
          index,
          maskedToken,
          status: isExhausted ? ('exhausted' as const) : ('active' as const),
          coreLimit: core.limit,
          coreRemaining: core.remaining,
          coreResetTime: core.reset * 1000, // convert to ms
          searchLimit: search.limit,
          searchRemaining: search.remaining,
          searchResetTime: search.reset * 1000, // convert to ms
          graphqlLimit: graphql.limit,
          graphqlRemaining: graphql.remaining,
          graphqlResetTime: graphql.reset * 1000, // convert to ms
        };
      } catch (err) {
        console.error(`[GithubTokenPool] Health check failed for token index ${index}:`, err);
        return {
          index,
          maskedToken,
          status: 'invalid' as const,
          coreLimit: 0,
          coreRemaining: 0,
          coreResetTime: 0,
          searchLimit: 0,
          searchRemaining: 0,
          searchResetTime: 0,
          graphqlLimit: 0,
          graphqlRemaining: 0,
          graphqlResetTime: 0,
        };
      }
    });

    return await Promise.all(healthPromises);
  }

  /**
   * Resets all exhaustion states (both local memory and Redis keys) to force-retry tokens.
   */
  public async resetTokenExhaustion(): Promise<void> {
    for (const state of this.tokens) {
      state.exhaustedUntil = 0;
      try {
        const key = this.getMaskedTokenKey(state.token);
        await redisConnection.del(key);
      } catch (err) {
        console.warn('[GithubTokenPool] Failed to clear token key on reset:', err);
      }
    }
    console.log('[GithubTokenPool] Reset all token exhaustion states.');
  }
}

export interface TokenHealthInfo {
  index: number;
  maskedToken: string;
  status: 'active' | 'exhausted' | 'invalid';
  coreLimit: number;
  coreRemaining: number;
  coreResetTime: number;
  searchLimit: number;
  searchRemaining: number;
  searchResetTime: number;
  graphqlLimit: number;
  graphqlRemaining: number;
  graphqlResetTime: number;
}

const globalForGithubPool = globalThis as unknown as {
  githubPool: GithubTokenPool | undefined;
};

export const githubPool = globalForGithubPool.githubPool ?? new GithubTokenPool();

if (process.env.NODE_ENV !== 'production') {
  globalForGithubPool.githubPool = githubPool;
}
