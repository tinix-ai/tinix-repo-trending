import { proxyManager } from './proxy';

export interface HNItem {
  created_at: string;
  title: string | null;
  url: string | null;
  author: string;
  points: number | null;
  story_text: string | null;
  comment_text: string | null;
  num_comments: number | null;
  objectID: string;
}

export interface SocialMentionInput {
  source: 'reddit' | 'x' | 'hacker_news';
  author: string;
  authorAvatarUrl?: string;
  content: string;
  url: string;
  score: number;
  commentsCount: number;
  mentionedAt: Date;
}

/**
 * Checks whether an HN item is actually relevant to the project.
 * This filters out false positives from short/ambiguous project names.
 */
function isRelevantHit(
  hit: HNItem,
  fullName: string,
  projectName: string,
  sourceUrlClean: string,
  homepageUrlClean: string | null
): boolean {
  const title = (hit.title || '').toLowerCase();
  const text = (hit.comment_text || hit.story_text || '').toLowerCase();
  const hitUrl = (hit.url || '').toLowerCase();
  const combined = `${title} ${text} ${hitUrl}`;

  const fullNameLower = fullName.toLowerCase();
  const projectNameLower = projectName.toLowerCase();
  const sourceUrlLower = sourceUrlClean.toLowerCase();

  // Strong match: contains full repo path (e.g. "vercel/next.js")
  if (combined.includes(fullNameLower)) return true;

  // Strong match: contains source URL (e.g. "github.com/vercel/next.js")
  if (combined.includes(sourceUrlLower)) return true;

  // Strong match: HN item links directly to the project
  if (hitUrl.includes(sourceUrlLower)) return true;

  // Strong match: contains homepage URL
  if (homepageUrlClean && combined.includes(homepageUrlClean.toLowerCase())) return true;

  // Weak match: only short project name found
  // Accept only if the project name is long enough (>= 5 chars) to reduce false positives
  // AND it appears as a distinct word boundary (not a substring of another word)
  if (projectNameLower.length >= 5 && combined.includes(projectNameLower)) {
    // Extra check: the project name should appear near recognizable context
    // (e.g., the language, "github", "repo", "library", "framework", etc.)
    const contextWords = ['github', 'repo', 'library', 'framework', 'tool', 'open source', 'npm', 'pip', 'crate'];
    const hasContext = contextWords.some(w => combined.includes(w));
    if (hasContext) return true;
  }

  return false;
}

export async function crawlHNMentions(
  fullName: string,
  projectName: string,
  sourceUrl: string,
  homepageUrl: string | null
): Promise<SocialMentionInput[]> {
  console.log(`[HN Crawler] Searching mentions for: ${fullName}`);

  // Prioritize fullName (owner/repo) as the primary search query for precision
  const searchQueries = [fullName];

  const cleanSourceUrl = sourceUrl.replace(/^https?:\/\/(www\.)?/, '');
  searchQueries.push(cleanSourceUrl);

  if (homepageUrl) {
    const cleanHomepage = homepageUrl.replace(/^https?:\/\/(www\.)?/, '');
    searchQueries.push(cleanHomepage);
  }

  const cleanHomepageUrl = homepageUrl ? homepageUrl.replace(/^https?:\/\/(www\.)?/, '') : null;
  const mentionsMap = new Map<string, SocialMentionInput>();

  for (const query of searchQueries) {
    const apiUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(query)}&tags=(story,comment)`;
    try {
      const dispatcher = proxyManager.getRandomDispatcher();
      const fetchOptions: RequestInit & { dispatcher?: unknown } = {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'TinixTrending/1.0'
        }
      };
      if (dispatcher) {
        fetchOptions.dispatcher = dispatcher;
      }

      const response = await fetch(apiUrl, fetchOptions);
      if (!response.ok) {
        console.warn(`[HN Crawler] HN search API returned status ${response.status} for query: ${query}`);
        continue;
      }

      const data = await response.json();
      const hits = (data.hits || []) as HNItem[];

      for (const hit of hits) {
        const hnUrl = `https://news.ycombinator.com/item?id=${hit.objectID}`;
        if (mentionsMap.has(hnUrl)) continue;

        // Relevance filter: skip hits that don't actually mention the project
        if (!isRelevantHit(hit, fullName, projectName, cleanSourceUrl, cleanHomepageUrl)) {
          continue;
        }

        // Minimum quality: skip very low-engagement items
        if ((hit.points || 0) < 2 && (hit.num_comments || 0) < 1) {
          continue;
        }

        let title = hit.title;
        const text = hit.comment_text || hit.story_text || '';

        if (!title) {
          if (text) {
            const cleanText = text.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
            title = cleanText.length > 60 ? cleanText.substring(0, 57) + '...' : cleanText;
          } else {
            title = `HN Mention #${hit.objectID}`;
          }
        }

        let content = text ? text.replace(/<[^>]*>/g, '\n').trim() : (hit.title || '');
        if (content.length > 500) {
          content = content.substring(0, 497) + '...';
        }

        mentionsMap.set(hnUrl, {
          source: 'hacker_news',
          author: hit.author || 'anonymous',
          content: content || title,
          url: hnUrl,
          score: hit.points || 0,
          commentsCount: hit.num_comments || 0,
          mentionedAt: new Date(hit.created_at)
        });
      }
    } catch (error) {
      console.error(`[HN Crawler] Error query "${query}" for ${fullName}:`, error);
    }
  }

  return Array.from(mentionsMap.values());
}
