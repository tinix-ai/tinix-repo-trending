import 'dotenv/config';
import { db } from './src/lib/db';
import { projects, projectSnapshots, projectTrends } from './src/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { fetchGitHubBatch } from './src/lib/crawlers/github-graphql';
import { calculateProjectTrendInline } from './src/lib/db/trends';
import { updateProjectCrawlSchedule } from './src/lib/crawlers/scheduler';

async function main() {
  const projectId = '7acd5b39-1650-4cdd-ab87-793b5a0287cf';
  const owner = 'gakonst';
  const repo = 'ethers-rs';

  console.log(`--- Dry Running crawler update for ${owner}/${repo} (${projectId}) ---`);

  // 1. Fetch from GitHub Batch
  console.log('Step 1: Fetching from GitHub...');
  const batchResults = await fetchGitHubBatch([{ owner, name: repo }]);
  const result = batchResults[0];
  console.log('Result exists:', result.exists, 'permissionDenied:', result.permissionDenied);

  if (!result.exists || result.permissionDenied) {
    console.log('Skipping due to exists/permissionDenied');
    return;
  }

  const data = result.data!;
  console.log('Fetched data stars:', data.stars);

  // 2. Update projects table
  console.log('\nStep 2: Updating projects table...');
  await db.update(projects)
    .set({
      name: data.name,
      fullName: data.fullName,
      description: data.description || '',
      homepageUrl: data.homepageUrl,
      primaryLanguage: data.primaryLanguage,
      license: data.license,
      topics: data.topics,
      stars: data.stars,
      forks: data.forks,
      watchers: data.watchers,
      openIssues: data.openIssues,
      sourceUpdatedAt: data.sourceUpdatedAt,
      lastCrawledAt: new Date(),
    })
    .where(eq(projects.id, projectId));
  console.log('Projects table updated.');

  // 3. Record snapshot
  console.log('\nStep 3: Recording snapshot...');
  const snapshotDateStr = new Date(Date.now() + 7 * 60 * 60 * 1000).toISOString().split('T')[0];
  console.log('Target snapshot date:', snapshotDateStr);

  const [existingSnap] = await db
    .select({ id: projectSnapshots.id })
    .from(projectSnapshots)
    .where(
      and(
        eq(projectSnapshots.projectId, projectId),
        eq(projectSnapshots.snapshotDate, snapshotDateStr)
      )
    )
    .limit(1);

  if (existingSnap) {
    console.log('Snapshot already exists with ID:', existingSnap.id, '. Updating...');
    await db.update(projectSnapshots)
      .set({
        stars: data.stars,
        forks: data.forks,
        openIssues: data.openIssues,
        watchers: data.watchers,
      })
      .where(eq(projectSnapshots.id, existingSnap.id));
    console.log('Snapshot updated.');
  } else {
    console.log('Snapshot does not exist. Inserting new snapshot...');
    await db.insert(projectSnapshots).values({
      projectId: projectId,
      stars: data.stars,
      forks: data.forks,
      openIssues: data.openIssues,
      watchers: data.watchers,
      snapshotDate: snapshotDateStr,
    });
    console.log('Snapshot inserted.');
  }

  // 4. Recalculate schedule and trends
  console.log('\nStep 4: Recalculating crawl schedule and trends...');
  await updateProjectCrawlSchedule(projectId, 'github');
  await calculateProjectTrendInline(projectId);
  console.log('Scheduler and trends recalculated.');

  // 5. Query snapshots after execution
  console.log('\nStep 5: Querying snapshots after run...');
  const snaps = await db.select().from(projectSnapshots).where(eq(projectSnapshots.projectId, projectId));
  console.log(snaps);

  const trends = await db.select().from(projectTrends).where(eq(projectTrends.projectId, projectId));
  console.log('Trends table row:', trends);

  process.exit(0);
}

main().catch(console.error);
