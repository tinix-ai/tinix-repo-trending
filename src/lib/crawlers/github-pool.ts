/**
 * GitHub Token Pool Manager
 * 
 * Manages a pool of GitHub API tokens with round-robin rotation and
 * automatic exhaustion tracking based on rate limit headers.
 * 
 * TODO: When running multiple processes (PM2 fork mode), each process has its own
 * in-memory token state. This means if token A is exhausted in process 1, processes
 * 2 and 3 may still try it. With 3+ tokens this is acceptable (they'll get a 403,
 * mark it exhausted locally, and move on). For larger deployments, consider storing
 * exhaustion state in Redis for cross-process coordination.
 */
interface TokenState {
  token: string;
  exhaustedUntil: number; // Timestamp in milliseconds
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

  /**
   * Retrieves an available token. If a token's lock duration has passed, it is automatically unexhausted.
   */
  public getAvailableToken(): string | null {
    if (this.tokens.length === 0) return null;

    const now = Date.now();
    let attempts = 0;

    while (attempts < this.tokens.length) {
      const state = this.tokens[this.currentIndex];
      
      if (state.exhaustedUntil < now) {
        // Token is good to use. Rotate index for round-robin.
        const token = state.token;
        this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
        return token;
      }

      // Move to next token
      this.currentIndex = (this.currentIndex + 1) % this.tokens.length;
      attempts++;
    }

    throw new Error('[GithubTokenPool] ALL tokens are currently exhausted due to Rate Limit. Please wait.');
  }

  /**
   * Marks a token as exhausted until the specified reset time.
   */
  public markTokenExhausted(token: string, resetTimeSeconds: string | null) {
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
    }
  }

  /**
   * Returns the timestamp when the next token becomes available.
   */
  public getNextAvailableTime(): number {
    if (this.tokens.length === 0) return 0;
    return Math.min(...this.tokens.map(t => t.exhaustedUntil));
  }
}

export const githubPool = new GithubTokenPool();
