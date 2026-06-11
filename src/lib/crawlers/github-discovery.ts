import { setTimeout } from "timers/promises";

interface DiscoveredRepo {
  owner: string;
  repo: string;
  stars: number;
}

/**
 * Discovers new AI/ML repositories using GitHub Search API.
 * Uses a cautious delay to respect the 30 req/min limit of the Search API.
 */
export async function discoverNewRepos(maxPages: number = 3): Promise<DiscoveredRepo[]> {
  const discovered: DiscoveredRepo[] = [];
  
  // We look for AI/ML topics, with a reasonable star threshold to filter spam
  const query = encodeURIComponent("topic:ai topic:machine-learning topic:llm stars:>100");
  const sort = "updated"; // Get most recently active
  const order = "desc";
  
  for (let page = 1; page <= maxPages; page++) {
    console.log(`[Discovery] Fetching page ${page} of GitHub Search...`);
    
    try {
      const response = await fetch(
        `https://api.github.com/search/repositories?q=${query}&sort=${sort}&order=${order}&per_page=100&page=${page}`,
        {
          headers: {
            "Accept": "application/vnd.github.v3+json",
            ...(process.env.GITHUB_TOKEN && {
              "Authorization": `Bearer ${process.env.GITHUB_TOKEN}`,
            }),
          },
        }
      );

      if (!response.ok) {
        if (response.status === 403 || response.status === 429) {
          console.warn("[Discovery] Hit Search API rate limit. Stopping discovery for this run.");
          break; // Stop paginating, we return what we have so far
        }
        throw new Error(`GitHub Search API error: ${response.statusText}`);
      }

      const data = await response.json();
      const items = data.items || [];
      
      if (items.length === 0) break; // No more results

      for (const item of items) {
        discovered.push({
          owner: item.owner.login,
          repo: item.name,
          stars: item.stargazers_count,
        });
      }

      // Safe delay (2.5 seconds) to avoid hitting 30 req/min rate limit (which is 1 req every 2s)
      if (page < maxPages) {
        await setTimeout(2500);
      }

    } catch (error) {
      console.error("[Discovery] Error during GitHub Search:", error);
      break; // Safe exit on error
    }
  }

  return discovered;
}
