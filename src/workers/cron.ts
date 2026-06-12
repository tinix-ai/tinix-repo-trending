import 'dotenv/config';
import { crawlerQueue, hfQueue } from './queue';
import { db } from '../lib/db';
import { projects } from '../lib/db/schema';
import { discoverNewRepos } from '../lib/crawlers/github-discovery';
import { discoverHFTrending } from '../lib/crawlers/hf-discovery';
import { eq, lte, or, isNull } from 'drizzle-orm';

/**
 * Job 1: Daily Discovery
 * Scans GitHub and HuggingFace for new AI/ML repos/models and adds them to the crawler queue.
 */
export async function runDailyDiscovery() {
  console.log('[Cron] Running Daily Discovery...');
  
  // 1. GitHub Discovery
  const newRepos = await discoverNewRepos();
  console.log(`[Cron] Discovered ${newRepos.length} trending repos from Search.`);

  const existingGitHub = await db.select({ sourceId: projects.sourceId }).from(projects).where(eq(projects.source, 'github'));
  const existingGHSet = new Set(existingGitHub.map(p => p.sourceId));

  let queuedCount = 0;
  for (const repo of newRepos) {
    const sourceId = `${repo.owner}/${repo.repo}`;
    if (!existingGHSet.has(sourceId)) {
      await crawlerQueue.add('crawl-repo', {
        owner: repo.owner,
        repo: repo.repo,
      }, {
        jobId: `discovery-${sourceId}`,
      });
      queuedCount++;
    }
  }
  console.log(`[Cron] Queued ${queuedCount} NEW GitHub repos for initial crawling.`);

  // 2. HuggingFace Discovery
  await discoverHFTrending();
}

/**
 * Job 2: Daily Update
 * Pulls ALL tracked projects from the DB and adds them to the respective queues for metric updates.
 */
export async function runDailyUpdate() {
  console.log('[Cron] Running Daily Update for tracked repos...');

  const trackedProjects = await db.select({ 
    id: projects.id,
    sourceId: projects.sourceId,
    source: projects.source,
    sourceUrl: projects.sourceUrl
  }).from(projects)
    .where(or(
      isNull(projects.nextCrawlAt),
      lte(projects.nextCrawlAt, new Date())
    ));

  let ghCount = 0;
  let hfCount = 0;

  for (const project of trackedProjects) {
    if (project.source === 'github') {
      const [owner, repo] = project.sourceId.split('/');
      if (owner && repo) {
        await crawlerQueue.add('crawl-repo', {
          owner,
          repo,
          projectId: project.id,
        }, {
          jobId: `update-gh-${project.id}-${new Date().toISOString().split('T')[0]}`, 
        });
        ghCount++;
      }
    } else if (project.source === 'huggingface') {
      const isDataset = project.sourceUrl?.includes('huggingface.co/datasets/');
      const type = isDataset ? 'datasets' : 'models';
      const jobName = isDataset ? 'crawl-hf-dataset' : 'crawl-hf-model';
      
      await hfQueue.add(jobName, {
        id: project.sourceId,
        type
      }, {
        jobId: `update-hf-${project.id}-${new Date().toISOString().split('T')[0]}`,
      });
      hfCount++;
    }
  }

  console.log(`[Cron] Queued ${ghCount} GitHub repos and ${hfCount} HuggingFace models for daily update.`);
}
