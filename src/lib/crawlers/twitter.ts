import { SocialMentionInput } from './hn';

/**
 * X/Twitter Crawler - DISABLED
 *
 * The X/Twitter API requires an Enterprise or Paid developer plan
 * ($100+/month) for search functionality. Without valid API credentials,
 * this crawler previously generated fake/simulated tweets using templates,
 * which polluted the database with inaccurate data.
 *
 * To re-enable: obtain X API Bearer Token, set TWITTER_BEARER_TOKEN in .env,
 * and implement the v2 search endpoint (GET /2/tweets/search/recent).
 */
export async function crawlTwitterMentions(
  fullName: string,
  _projectName: string,
  _ownerName: string,
  _language: string | null,
  _topics: string[],
  _description: string | null
): Promise<SocialMentionInput[]> {
  console.log(`[X Crawler] Skipped for ${fullName} (X API not configured - requires paid plan)`);
  return [];
}
