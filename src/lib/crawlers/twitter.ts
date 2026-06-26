import { SocialMentionInput } from './hn';
import { proxyManager } from './proxy';

/**
 * X/Twitter Crawler
 * Uses the API v2 Search endpoint to fetch tweets in bulk.
 * Requires TWITTER_BEARER_TOKEN in environment variables.
 */

export interface TwitterProjectTarget {
  projectId: string;
  keyword: string;
}

export async function crawlTwitterMentionsBatched(
  targets: TwitterProjectTarget[]
): Promise<Map<string, SocialMentionInput[]>> {
  const token = process.env.TWITTER_BEARER_TOKEN;
  if (!token) {
    console.log(`[X Crawler] Skipped batch of ${targets.length} projects (TWITTER_BEARER_TOKEN not configured)`);
    return new Map();
  }

  const results = new Map<string, SocialMentionInput[]>();
  targets.forEach(t => results.set(t.projectId, []));

  // Chunk targets to fit within Twitter's query length limit (512 chars for basic API)
  const chunks: TwitterProjectTarget[][] = [];
  let currentChunk: TwitterProjectTarget[] = [];
  let currentLength = 0;

  for (const target of targets) {
    // keyword might be something like "tinix-repo-trending"
    // query format: ("kw1") OR ("kw2")
    const addedLength = `("${target.keyword}") OR `.length;
    if (currentLength + addedLength > 450) {
      chunks.push(currentChunk);
      currentChunk = [target];
      currentLength = addedLength;
    } else {
      currentChunk.push(target);
      currentLength += addedLength;
    }
  }
  if (currentChunk.length > 0) chunks.push(currentChunk);

  for (const chunk of chunks) {
    const queryStr = chunk.map(t => `"${t.keyword}"`).join(' OR ');
    try {
      const url = new URL('https://api.twitter.com/2/tweets/search/recent');
      url.searchParams.append('query', queryStr);
      url.searchParams.append('tweet.fields', 'public_metrics,created_at,author_id');
      url.searchParams.append('expansions', 'author_id');
      url.searchParams.append('user.fields', 'username,profile_image_url');
      url.searchParams.append('max_results', '100');

      const headers = {
        'Authorization': `Bearer ${token}`
      };
      
      const dispatcher = proxyManager.getRandomDispatcher();
      const fetchOptions: RequestInit & { dispatcher?: unknown } = { headers };
      if (dispatcher) fetchOptions.dispatcher = dispatcher;

      const response = await fetch(url.toString(), fetchOptions);

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`[X Crawler] Rate limited by Twitter API. Stopping batch crawling early.`);
          break; // Stop querying subsequent chunks
        }
        throw new Error(`Twitter API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const tweets = data.data || [];
      const users = data.includes?.users || [];
      
      const userMap = new Map();
      for (const u of users) {
        userMap.set(u.id, u);
      }

      for (const tweet of tweets) {
        // Find which project this tweet belongs to by matching the keyword
        const text = tweet.text.toLowerCase();
        for (const target of chunk) {
          if (text.includes(target.keyword.toLowerCase())) {
            const author = userMap.get(tweet.author_id);
            const authorUsername = author ? author.username : 'unknown';
            
            // Map metrics: Twitter uses retweets/likes. We can map them as "score" / "upvotes"
            const metrics = tweet.public_metrics || {};
            const likes = metrics.like_count || 0;
            const retweets = metrics.retweet_count || 0;
            const replies = metrics.reply_count || 0;
            
            const mention: SocialMentionInput = {
              source: 'x',
              author: authorUsername,
              authorAvatarUrl: author?.profile_image_url,
              content: tweet.text || '',
              url: `https://twitter.com/${authorUsername}/status/${tweet.id}`,
              score: likes + (retweets * 2) + replies,
              commentsCount: replies,
              mentionedAt: new Date(tweet.created_at),
            };
            
            results.get(target.projectId)?.push(mention);
            break; // Assuming a tweet matches at least one keyword, assign to the first match
          }
        }
      }
    } catch (err) {
      console.error(`[X Crawler] Error fetching batch:`, err);
    }
  }

  return results;
}

export async function crawlTwitterMentions(
  fullName: string,
  _projectName: string,
  _ownerName: string,
  _language: string | null,
  _topics: string[],
  _description: string | null
): Promise<SocialMentionInput[]> {
  // Backwards compatibility for single-job runners. Note this doesn't have the project id 
  // but we can mock one to use the batch fn.
  const map = await crawlTwitterMentionsBatched([{ projectId: 'temp', keyword: fullName }]);
  return map.get('temp') || [];
}
