import 'dotenv/config';
import { discoverNewRepos } from '../src/lib/crawlers/github-discovery';

async function main() {
  console.log("Running Updated GitHub Discovery Crawler Test...");
  try {
    const repos = await discoverNewRepos(1); // Fetch 1 page per topic
    console.log(`Crawler Test Finished! Found ${repos.length} unique repos.`);
    console.log("Sample discovered repos:", repos.slice(0, 10).map(r => `${r.owner}/${r.repo} (stars: ${r.stars})`));
  } catch (error) {
    console.error("Crawler Test Failed:", error);
  }
  process.exit(0);
}

main().catch(console.error);
