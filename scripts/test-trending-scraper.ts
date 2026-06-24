import "dotenv/config";
import { discoverGithubTrendingRepos } from "../src/lib/crawlers/github-trending-scraper";

async function main() {
  console.log("Starting GitHub Trending HTML Scraper Test...");
  try {
    const repos = await discoverGithubTrendingRepos();
    console.log(`\nHTML Scraper Test Finished! Found ${repos.length} unique trending repos.`);
    
    if (repos.length > 0) {
      console.log("\nSample discovered repos:");
      repos.slice(0, 15).forEach((r, idx) => {
        console.log(`${idx + 1}. ${r.owner}/${r.repo}`);
      });
    } else {
      console.warn("\nNo repositories discovered. Check HTML parsing or connection.");
    }
  } catch (error) {
    console.error("HTML Scraper Test Failed:", error);
  }
  process.exit(0);
}

main().catch(console.error);
