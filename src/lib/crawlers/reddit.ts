import { SocialMentionInput } from './hn';

interface RedditChild {
  kind: string;
  data: {
    subreddit_name_prefixed: string;
    title: string;
    selftext: string;
    author: string;
    permalink: string;
    score: number;
    num_comments: number;
    created_utc: number;
  };
}

interface RedditTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

// In-memory token cache
let cachedToken: { token: string; expiresAt: number } | null = null;

async function getRedditAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return null;
  }

  // Return cached token if still valid (with 60s buffer)
  if (cachedToken && Date.now() < cachedToken.expiresAt - 60_000) {
    return cachedToken.token;
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  const userAgent = process.env.REDDIT_USER_AGENT || 'TinixTrending/1.0';

  try {
    const response = await fetch('https://www.reddit.com/api/v1/access_token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': userAgent,
      },
      body: new URLSearchParams({ grant_type: 'client_credentials' }),
    });

    if (!response.ok) {
      console.error(`[Reddit Crawler] OAuth token request failed: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = (await response.json()) as RedditTokenResponse;
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    return data.access_token;
  } catch (error) {
    console.error('[Reddit Crawler] Failed to obtain OAuth token:', error);
    return null;
  }
}

export async function crawlRedditMentions(
  fullName: string,
  projectName: string,
  sourceUrl: string,
  homepageUrl: string | null
): Promise<SocialMentionInput[]> {
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.warn('[Reddit Crawler] Reddit client credentials not configured. Reddit crawling is temporarily disabled.');
    return [];
  }

  console.log(`[Reddit Crawler] Searching mentions for: ${fullName}`);

  // Try OAuth2 authenticated flow first
  const token = await getRedditAccessToken();
  if (token) {
    return crawlWithOAuth(token, fullName, projectName, sourceUrl, homepageUrl);
  }

  console.warn('[Reddit Crawler] Reddit credentials configured but token generation failed.');
  return [];
}

async function crawlWithOAuth(
  token: string,
  fullName: string,
  projectName: string,
  sourceUrl: string,
  homepageUrl: string | null
): Promise<SocialMentionInput[]> {
  const userAgent = process.env.REDDIT_USER_AGENT || 'TinixTrending/1.0';

  const queries = [
    `"${fullName}"`,
    `"${sourceUrl.replace(/^https?:\/\/(www\.)?/, '')}"`,
  ];
  if (homepageUrl) {
    queries.push(`"${homepageUrl.replace(/^https?:\/\/(www\.)?/, '')}"`);
  }

  const query = queries.join(' OR ');
  const apiUrl = `https://oauth.reddit.com/search?q=${encodeURIComponent(query)}&sort=new&limit=10`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      console.warn(`[Reddit Crawler] OAuth search returned status ${response.status}`);
      // If token expired mid-request, invalidate cache
      if (response.status === 401) {
        cachedToken = null;
      }
      return [];
    }

    const data = await response.json();
    return parseRedditResults(data);
  } catch (error) {
    console.error(`[Reddit Crawler] OAuth search error for ${fullName}:`, error);
    return [];
  }
}

function parseRedditResults(data: Record<string, unknown>): SocialMentionInput[] {
  const children = ((data as Record<string, Record<string, unknown>>).data?.children || []) as RedditChild[];
  const mentions: SocialMentionInput[] = [];

  for (const child of children) {
    if (child.kind !== 't3') continue;

    const { subreddit_name_prefixed, title, selftext, author, permalink, score, num_comments, created_utc } = child.data;
    const redditUrl = `https://www.reddit.com${permalink}`;

    let content = selftext ? selftext.trim() : title;
    if (content.length > 500) {
      content = content.substring(0, 497) + '...';
    }

    mentions.push({
      source: 'reddit',
      author: `${subreddit_name_prefixed}/${author}`,
      content: `${title}\n\n${content}`,
      url: redditUrl,
      score: score || 0,
      commentsCount: num_comments || 0,
      mentionedAt: new Date(created_utc * 1000),
    });
  }

  return mentions;
}
