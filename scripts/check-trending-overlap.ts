import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { eq } from 'drizzle-orm';
import { discoverGithubTrendingRepos } from '../src/lib/crawlers/github-trending-scraper';

async function main() {
  console.log("Analyzing GitHub Trending Overlap with Database...");
  
  try {
    // 1. Fetch current trending repos from HTML Scraper
    const trendingRepos = await discoverGithubTrendingRepos();
    console.log(`\nDiscovered ${trendingRepos.length} trending repos from GitHub.`);

    // 2. Fetch all existing projects from Database
    const existingGitHub = await db
      .select({ id: projects.id, sourceId: projects.sourceId, fullName: projects.fullName })
      .from(projects)
      .where(eq(projects.source, 'github'));
    
    console.log(`Total GitHub projects currently in Database: ${existingGitHub.length}`);

    // Create lookup map
    const existingMap = new Map(existingGitHub.map(p => [p.sourceId.toLowerCase(), p.fullName]));

    const existingRepos: string[] = [];
    const newRepos: string[] = [];

    for (const repo of trendingRepos) {
      const sourceId = `${repo.owner}/${repo.repo}`.toLowerCase();
      if (existingMap.has(sourceId)) {
        existingRepos.push(existingMap.get(sourceId) || `${repo.owner}/${repo.repo}`);
      } else {
        newRepos.push(`${repo.owner}/${repo.repo}`);
      }
    }

    console.log("\n=================== OVERLAP RESULTS ===================");
    console.log(`Existing in Database: ${existingRepos.length} / ${trendingRepos.length} (${((existingRepos.length / trendingRepos.length) * 100).toFixed(1)}%)`);
    console.log(`New (Not in Database): ${newRepos.length} / ${trendingRepos.length} (${((newRepos.length / trendingRepos.length) * 100).toFixed(1)}%)`);
    console.log("=======================================================");

    if (existingRepos.length > 0) {
      console.log("\nSome trending repos ALREADY IN our database:");
      existingRepos.slice(0, 10).forEach((name, idx) => console.log(` - ${idx + 1}. ${name}`));
    }

    if (newRepos.length > 0) {
      console.log("\nSome trending repos NOT YET IN our database (Will be discovered):");
      newRepos.slice(0, 10).forEach((name, idx) => console.log(` - ${idx + 1}. ${name}`));
    }

  } catch (error) {
    console.error("Error checking overlap:", error);
  }
  process.exit(0);
}

main().catch(console.error);
