"use server";

import { getDynamicTrendingProjects, ProjectQueryParams, getGlobalStats, getProjectBySlug, getProjectHistory, getProjectById, getCategoryStats, getPopularLanguagesAndHashtags } from "@/lib/db/queries";
import type { RankedProject } from "@/types";
import { redisConnection, crawlerQueue, hfQueue, schedulerQueue } from "@/workers/queue";
import { discoverNewRepos } from "@/lib/crawlers/github-discovery";
import { discoverHFTrending } from "@/lib/crawlers/hf-discovery";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { eq, sql, ilike, or } from "drizzle-orm";

export async function fetchDynamicRankings(params: ProjectQueryParams): Promise<{ projects: RankedProject[], total: number }> {
  try {
    return await getDynamicTrendingProjects(params);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return { projects: [], total: 0 };
  }
}

export async function fetchGlobalStats() {
  return await getGlobalStats();
}

export async function fetchCategoryStats() {
  return await getCategoryStats();
}

export async function fetchPopularFilters() {
  return await getPopularLanguagesAndHashtags();
}

export async function fetchProjectDetails(slug: string) {
  return await getProjectBySlug(slug);
}

export async function fetchProjectById(id: string) {
  return await getProjectById(id);
}

export async function triggerCrawlerSync(source: 'github' | 'huggingface') {
  console.log(`[Admin] Triggering sync for ${source}...`);
  try {
    if (source === 'github') {
      // Run GitHub discovery as a background promise so we respond fast
      (async () => {
        try {
          const newRepos = await discoverNewRepos(2); // Keep it to 2 pages for quick discovery
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
                jobId: `discovery-${sourceId}-${Date.now()}`,
              });
              queuedCount++;
            }
          }
          console.log(`[Admin] Finished GitHub sync trigger. Queued ${queuedCount} NEW GitHub repos.`);
        } catch (err) {
          console.error("[Admin] Error during async GitHub discovery:", err);
        }
      })();
    } else if (source === 'huggingface') {
      // Run HuggingFace discovery asynchronously
      (async () => {
        try {
          await discoverHFTrending();
          console.log("[Admin] Finished HuggingFace sync trigger.");
        } catch (err) {
          console.error("[Admin] Error during async HuggingFace discovery:", err);
        }
      })();
    }
    return { success: true, message: `Sync for ${source} triggered successfully in the background.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to trigger ${source} sync:`, error);
    return { success: false, message: `Error: ${errorMsg}` };
  }
}

export async function fetchQueueStats() {
  try {
    const [ghWaiting, ghActive, ghCompleted, ghFailed] = await Promise.all([
      crawlerQueue.getWaitingCount(),
      crawlerQueue.getActiveCount(),
      crawlerQueue.getCompletedCount(),
      crawlerQueue.getFailedCount(),
    ]);

    const [hfWaiting, hfActive, hfCompleted, hfFailed] = await Promise.all([
      hfQueue.getWaitingCount(),
      hfQueue.getActiveCount(),
      hfQueue.getCompletedCount(),
      hfQueue.getFailedCount(),
    ]);

    return {
      github: { waiting: ghWaiting, active: ghActive, completed: ghCompleted, failed: ghFailed },
      huggingface: { waiting: hfWaiting, active: hfActive, completed: hfCompleted, failed: hfFailed },
    };
  } catch (error) {
    console.error("Failed to fetch queue stats from Redis:", error);
    return {
      github: { waiting: 0, active: 0, completed: 0, failed: 0 },
      huggingface: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };
  }
}

export async function fetchDetailedQueueStats() {
  try {
    const getQueueDetails = async (queue: typeof crawlerQueue, queueName: string) => {
      const [waiting, active, completed, failed, delayed, paused] = await Promise.all([
        queue.getWaitingCount(),
        queue.getActiveCount(),
        queue.getCompletedCount(),
        queue.getFailedCount(),
        queue.getDelayedCount(),
        queue.isPaused(),
      ]);

      // Get breakdown for discovery vs update
      let discovery = 0;
      let update = 0;

      try {
        const [waitingIds, activeJobs] = await Promise.all([
          redisConnection.lrange(`bull:${queueName}:wait`, 0, -1),
          queue.getActive(),
        ]);
        const activeIds = activeJobs.map(j => j.id).filter((id): id is string => typeof id === 'string');

        const classify = (id: string) => {
          if (
            id.startsWith('discovery-') || 
            id.startsWith('bootstrap-') || 
            id.startsWith('hf-model-') || 
            id.startsWith('hf-dataset-') ||
            id.startsWith('hf-') ||
            id.includes('manual-submit-')
          ) {
            discovery++;
          } else if (id.startsWith('update-')) {
            update++;
          } else {
            // Default to discovery if unknown prefix
            discovery++;
          }
        };

        waitingIds.forEach(classify);
        activeIds.forEach(classify);
      } catch (redisError) {
        console.error(`Failed to scan job IDs for ${queueName}:`, redisError);
      }

      return { 
        waiting, 
        active, 
        completed, 
        failed, 
        delayed, 
        isPaused: paused, 
        total: completed + failed,
        discovery,
        update
      };
    };

    const [github, huggingface] = await Promise.all([
      getQueueDetails(crawlerQueue, 'github-crawler'),
      getQueueDetails(hfQueue, 'hf-crawler'),
    ]);

    return { github, huggingface };
  } catch (error) {
    console.error("Failed to fetch detailed queue stats:", error);
    const empty = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0, isPaused: false, total: 0, discovery: 0, update: 0 };
    return { github: empty, huggingface: empty };
  }
}

export async function pauseQueue(source: 'github' | 'huggingface') {
  try {
    const queue = source === 'github' ? crawlerQueue : hfQueue;
    await queue.pause();
    return { success: true, message: `${source} queue paused.` };
  } catch (error) {
    console.error(`Failed to pause ${source} queue:`, error);
    return { success: false, message: `Failed to pause ${source} queue.` };
  }
}

export async function resumeQueue(source: 'github' | 'huggingface') {
  try {
    const queue = source === 'github' ? crawlerQueue : hfQueue;
    await queue.resume();
    return { success: true, message: `${source} queue resumed.` };
  } catch (error) {
    console.error(`Failed to resume ${source} queue:`, error);
    return { success: false, message: `Failed to resume ${source} queue.` };
  }
}

export async function drainQueue(source: 'github' | 'huggingface') {
  try {
    const queue = source === 'github' ? crawlerQueue : hfQueue;
    await queue.drain();
    return { success: true, message: `${source} queue drained. All waiting jobs removed.` };
  } catch (error) {
    console.error(`Failed to drain ${source} queue:`, error);
    return { success: false, message: `Failed to drain ${source} queue.` };
  }
}

export async function retryFailedJobs(source: 'github' | 'huggingface') {
  try {
    const queue = source === 'github' ? crawlerQueue : hfQueue;
    const failedJobs = await queue.getFailed(0, 100);
    let retried = 0;
    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }
    return { success: true, message: `Retried ${retried} failed jobs in ${source} queue.` };
  } catch (error) {
    console.error(`Failed to retry jobs in ${source} queue:`, error);
    return { success: false, message: `Failed to retry failed jobs.` };
  }
}

export interface RecentJob {
  id: string;
  name: string;
  data: string;
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed';
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
}

export async function fetchRecentJobs(
  source: 'github' | 'huggingface' | 'all',
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'all',
  page: number = 0,
  limit: number = 10
): Promise<{ jobs: RecentJob[]; total: number }> {
  try {
    const queues = source === 'all'
      ? [{ queue: crawlerQueue, label: 'github' }, { queue: hfQueue, label: 'huggingface' }]
      : [{ queue: source === 'github' ? crawlerQueue : hfQueue, label: source }];

    const allJobs: RecentJob[] = [];

    for (const { queue, label } of queues) {
      const statuses: ('active' | 'completed' | 'failed' | 'waiting')[] =
        status === 'all' ? ['active', 'completed', 'failed', 'waiting'] : [status];

      for (const s of statuses) {
        let jobs;
        switch (s) {
          case 'active': jobs = await queue.getActive(0, limit); break;
          case 'completed': jobs = await queue.getCompleted(0, limit); break;
          case 'failed': jobs = await queue.getFailed(0, limit); break;
          case 'waiting': jobs = await queue.getWaiting(0, limit); break;
        }
        for (const job of jobs) {
          const dataStr = label === 'github'
            ? `${job.data?.owner || ''}/${job.data?.repo || ''}`
            : `${job.data?.id || ''}`;
          allJobs.push({
            id: job.id || '',
            name: job.name,
            data: dataStr,
            status: s,
            timestamp: job.timestamp || 0,
            processedOn: job.processedOn || null,
            finishedOn: job.finishedOn || null,
            failedReason: job.failedReason || null,
          });
        }
      }
    }

    // Sort by timestamp descending
    allJobs.sort((a, b) => b.timestamp - a.timestamp);
    const start = page * limit;
    return { jobs: allJobs.slice(start, start + limit), total: allJobs.length };
  } catch (error) {
    console.error("Failed to fetch recent jobs:", error);
    return { jobs: [], total: 0 };
  }
}

export async function fetchCrawlerReport() {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE source = 'github') as github_total,
        COUNT(*) FILTER (WHERE source = 'huggingface' AND project_type = 'model') as hf_models,
        COUNT(*) FILTER (WHERE source = 'huggingface' AND project_type = 'dataset') as hf_datasets,
        COUNT(*) FILTER (WHERE last_crawled_at >= NOW() - INTERVAL '24 hours') as crawled_24h,
        COUNT(*) FILTER (WHERE last_crawled_at >= NOW() - INTERVAL '7 days') as crawled_7d,
        COUNT(*) FILTER (WHERE source = 'github' AND last_crawled_at >= NOW() - INTERVAL '24 hours') as github_24h,
        COUNT(*) FILTER (WHERE source = 'huggingface' AND last_crawled_at >= NOW() - INTERVAL '24 hours') as hf_24h,
        COUNT(*) FILTER (WHERE source = 'github' AND last_crawled_at >= NOW() - INTERVAL '7 days') as github_7d,
        COUNT(*) FILTER (WHERE source = 'huggingface' AND last_crawled_at >= NOW() - INTERVAL '7 days') as hf_7d,
        COUNT(*) as total_projects
      FROM projects
    `);

    const r = result[0] as Record<string, unknown>;
    return {
      githubTotal: Number(r.github_total || 0),
      hfModels: Number(r.hf_models || 0),
      hfDatasets: Number(r.hf_datasets || 0),
      crawled24h: Number(r.crawled_24h || 0),
      crawled7d: Number(r.crawled_7d || 0),
      github24h: Number(r.github_24h || 0),
      hf24h: Number(r.hf_24h || 0),
      github7d: Number(r.github_7d || 0),
      hf7d: Number(r.hf_7d || 0),
      totalProjects: Number(r.total_projects || 0),
    };
  } catch (error) {
    console.error("Failed to fetch crawler report:", error);
    return {
      githubTotal: 0, hfModels: 0, hfDatasets: 0,
      crawled24h: 0, crawled7d: 0,
      github24h: 0, hf24h: 0, github7d: 0, hf7d: 0,
      totalProjects: 0,
    };
  }
}

export async function fetchProjectHistory(projectId: string, days: number = 30) {
  return await getProjectHistory(projectId, days);
}



export async function submitProject(
  prevState: { success: boolean; error: string; message: string } | null,
  formData: FormData
) {
  const url = formData.get('url') as string;
  if (!url) {
    return { success: false, error: 'URL is required', message: '' };
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.replace(/^\/|\/$/g, '');
    const parts = pathname.split('/');

    if (hostname === 'github.com') {
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts[1];
        await crawlerQueue.add('crawl-repo', { owner, repo }, {
          jobId: `manual-submit-${owner}-${repo}-${Date.now()}`
        });
        return { success: true, message: 'GitHub repository added to processing queue', error: '' };
      }
    } else if (hostname === 'huggingface.co') {
      if (parts[0] === 'datasets' && parts.length >= 3) {
        const id = `${parts[1]}/${parts[2]}`;
        await hfQueue.add('crawl-hf-dataset', { id, type: 'datasets' }, {
          jobId: `manual-submit-${id.replace('/', '-')}-${Date.now()}`
        });
        return { success: true, message: 'HuggingFace dataset added to processing queue', error: '' };
      } else if (parts.length >= 2) {
        // Assume model
        const id = `${parts[0]}/${parts[1]}`;
        await hfQueue.add('crawl-hf-model', { id, type: 'models' }, {
          jobId: `manual-submit-${id.replace('/', '-')}-${Date.now()}`
        });
        return { success: true, message: 'HuggingFace model added to processing queue', error: '' };
      }
    }

    return { success: false, error: 'Invalid GitHub or HuggingFace URL', message: '' };
  } catch {
    return { success: false, error: 'Invalid URL format', message: '' };
  }
}

export interface ProjectCrawlStatus {
  id: string;
  name: string;
  fullName: string;
  source: string;
  projectType: string;
  lastCrawledAt: Date | null;
  crawlInterval: number;
  nextCrawlAt: Date | null;
}

export async function fetchProjectsCrawlStatus(
  query: string,
  page: number = 0,
  limit: number = 10
): Promise<{ projects: ProjectCrawlStatus[]; total: number }> {
  try {
    const offset = page * limit;
    
    const searchFilter = query 
      ? or(
          ilike(projects.name, `%${query}%`),
          ilike(projects.fullName, `%${query}%`),
          ilike(projects.slug, `%${query}%`)
        )
      : undefined;

    const totalResult = await db
      .select({ count: sql`count(*)` })
      .from(projects)
      .where(searchFilter);
    const total = Number(totalResult[0]?.count || 0);

    const data = await db
      .select({
        id: projects.id,
        name: projects.name,
        fullName: projects.fullName,
        source: projects.source,
        projectType: projects.projectType,
        lastCrawledAt: projects.lastCrawledAt,
        crawlInterval: projects.crawlInterval,
        nextCrawlAt: projects.nextCrawlAt,
      })
      .from(projects)
      .where(searchFilter)
      .limit(limit)
      .offset(offset);

    const mappedProjects = data.map(p => ({
      id: p.id,
      name: p.name,
      fullName: p.fullName,
      source: p.source,
      projectType: p.projectType,
      lastCrawledAt: p.lastCrawledAt,
      crawlInterval: p.crawlInterval || 1,
      nextCrawlAt: p.nextCrawlAt,
    }));

    return { projects: mappedProjects, total };
  } catch (error) {
    console.error("Failed to fetch project crawl status:", error);
    return { projects: [], total: 0 };
  }
}

export async function forceRecrawlProject(projectId: string) {
  try {
    const [project] = await db
      .select()
      .from(projects)
      .where(eq(projects.id, projectId));
      
    if (!project) {
      return { success: false, message: "Project not found." };
    }

    if (project.source === 'github') {
      const [owner, repo] = project.sourceId.split('/');
      if (owner && repo) {
        await crawlerQueue.add('crawl-repo', {
          owner,
          repo,
          projectId: project.id,
        }, {
          jobId: `force-gh-${project.id}-${Date.now()}`,
        });
      } else {
        return { success: false, message: "Invalid sourceId format for GitHub repository." };
      }
    } else if (project.source === 'huggingface') {
      const isDataset = project.sourceUrl?.includes('huggingface.co/datasets/');
      const type = isDataset ? 'datasets' : 'models';
      const jobName = isDataset ? 'crawl-hf-dataset' : 'crawl-hf-model';
      
      await hfQueue.add(jobName, {
        id: project.sourceId,
        type
      }, {
        jobId: `force-hf-${project.id}-${Date.now()}`,
      });
    } else {
      return { success: false, message: `Unsupported source: ${project.source}` };
    }

    // Set nextCrawlAt slightly in the future to avoid immediate duplicate scheduling
    await db
      .update(projects)
      .set({
        nextCrawlAt: new Date(Date.now() + 1 * 24 * 60 * 60 * 1000),
      })
      .where(eq(projects.id, projectId));

    return { success: true, message: `Successfully queued force update for ${project.fullName}.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error("Failed to force recrawl:", error);
    return { success: false, message: `Error: ${errorMsg}` };
  }
}

// ----------------------------------------------------------------------------
// 3. SCHEDULED JOBS MANAGEMENT
// ----------------------------------------------------------------------------

export interface ScheduledJob {
  key: string;
  name: string;
  id: string;
  endDate: number | null;
  tz: string | null;
  pattern: string;
  next: number;
}

export async function getScheduledJobs(): Promise<ScheduledJob[]> {
  if (!schedulerQueue) return [];
  try {
    const jobs = await schedulerQueue.getRepeatableJobs();
    return jobs.map(job => ({
      key: job.key,
      name: job.name,
      id: job.id || '',
      endDate: job.endDate || null,
      tz: job.tz || null,
      pattern: job.pattern || '',
      next: job.next || 0,
    }));
  } catch (error) {
    console.error('Failed to fetch scheduled jobs:', error);
    return [];
  }
}

export async function triggerJobNow(name: string) {
  try {
    if (!schedulerQueue) throw new Error('Scheduler queue not initialized');
    // Add the job directly to the queue for immediate execution
    await schedulerQueue.add(name, {}, { jobId: `manual-${name}-${Date.now()}` });
    return { success: true, message: `Triggered ${name} manually` };
  } catch (error) {
    console.error('Failed to trigger job:', error);
    return { success: false, message: 'Failed to trigger job' };
  }
}

export async function removeScheduledJob(key: string) {
  try {
    if (!schedulerQueue) throw new Error('Scheduler queue not initialized');
    await schedulerQueue.removeRepeatableByKey(key);
    return { success: true, message: 'Removed scheduled job' };
  } catch (error) {
    console.error('Failed to remove scheduled job:', error);
    return { success: false, message: 'Failed to remove job' };
  }
}
