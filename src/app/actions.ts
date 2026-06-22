"use server";

import { Queue } from "bullmq";
import { getDynamicTrendingProjects, ProjectQueryParams, getGlobalStats, getProjectBySlug, getProjectHistory, getProjectById, getCategoryStats, getPopularLanguagesAndHashtags, getDatabaseStorageStats, getLanguageStats, getDataStalenessStats } from "@/lib/db/queries";
import os from "os";

import type { RankedProject } from "@/types";
import { redisConnection, crawlerQueue, hfQueue, githubUpdaterQueue, hfUpdaterQueue, schedulerQueue } from "@/workers/queue";
import { githubPool } from "@/lib/crawlers/github-pool";
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
  console.log(`[Admin] Triggering sync for ${source} via scheduler queue...`);
  try {
    // Delegate discovery to the scheduler worker process instead of running
    // heavy crawling operations directly inside the Next.js server process.
    await schedulerQueue.add('daily-discovery', { source, force: true }, {
      jobId: `manual-sync-${source}-${Date.now()}`,
    });

    // Auto-resume downstream crawler queues so jobs get processed immediately
    if (source === 'github') {
      await crawlerQueue.resume();
    } else {
      await hfQueue.resume();
    }

    return { success: true, message: `Sync for ${source} queued successfully via scheduler.` };
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
    const getQueueDetails = async (queue: Queue, queueName: string) => {
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
      const waitingCount = waiting;

      // With the isolated 5-queue architecture, each queue has a dedicated purpose.
      // - github-crawler & hf-crawler are for new project discovery.
      // - github-updater & hf-updater are for daily metrics updates.
      // This allows us to classify job types in O(1) without fetching and scanning thousands of job IDs from Redis.
      if (queueName === 'github-crawler' || queueName === 'hf-crawler') {
        discovery = waitingCount + active;
      } else if (queueName === 'github-updater' || queueName === 'hf-updater') {
        update = waitingCount + active;
      }

      // Use Redis all-time counters for display if available,
      // but keep BullMQ real-time counts for action button logic (e.g. Retry).
      let completedDisplay = completed;
      let failedDisplay = failed;
      try {
        const [redisCompleted, redisFailed] = await Promise.all([
          redisConnection.get(`crawler:stats:${queueName}:completed`),
          redisConnection.get(`crawler:stats:${queueName}:failed`),
        ]);
        if (redisCompleted !== null) completedDisplay = parseInt(redisCompleted, 10);
        if (redisFailed !== null) failedDisplay = parseInt(redisFailed, 10);
      } catch (err) {
        console.warn(`[Actions] Failed to fetch all-time stats for ${queueName}:`, err);
      }

      return { 
        waiting: waitingCount, 
        active, 
        completed: completedDisplay,     // All-time for display
        failed: failedDisplay,           // All-time for display
        currentFailed: failed,           // BullMQ real-time: actual retryable jobs right now
        delayed, 
        isPaused: paused, 
        total: completedDisplay + failedDisplay,
        discovery,
        update
      };
    };

    const [github, huggingface, githubUpdater, hfUpdater, scheduler, activeSchedulerJobs] = await Promise.all([
      getQueueDetails(crawlerQueue, 'github-crawler'),
      getQueueDetails(hfQueue, 'hf-crawler'),
      getQueueDetails(githubUpdaterQueue, 'github-updater'),
      getQueueDetails(hfUpdaterQueue, 'hf-updater'),
      schedulerQueue 
        ? getQueueDetails(schedulerQueue, 'scheduler-queue')
        : Promise.resolve({ waiting: 0, active: 0, completed: 0, failed: 0, currentFailed: 0, delayed: 0, isPaused: false, total: 0, discovery: 0, update: 0 }),
      schedulerQueue ? schedulerQueue.getActive() : Promise.resolve([]),
    ]);

    const [githubSyncRunning, hfSyncRunning] = await Promise.all([
      redisConnection.get('crawler:sync:github:running'),
      redisConnection.get('crawler:sync:huggingface:running'),
    ]);

    const activeJobNames = activeSchedulerJobs.map(j => j.name);

    return { 
      github: { ...github, isSyncRunning: githubSyncRunning === 'true' }, 
      huggingface: { ...huggingface, isSyncRunning: hfSyncRunning === 'true' }, 
      githubUpdater,
      hfUpdater,
      scheduler, 
      activeSchedulerJobs: activeJobNames 
    };
  } catch (error) {
    console.error("Failed to fetch detailed queue stats:", error);
    const empty = { waiting: 0, active: 0, completed: 0, failed: 0, currentFailed: 0, delayed: 0, isPaused: false, total: 0, discovery: 0, update: 0 };
    return { github: empty, huggingface: empty, githubUpdater: empty, hfUpdater: empty, scheduler: empty, activeSchedulerJobs: [] };
  }
}


export async function pauseQueue(source: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler') {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[source];
    if (!queue) throw new Error(`Queue ${source} not initialized`);
    await queue.pause();
    return { success: true, message: `${source} queue paused.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to pause ${source} queue:`, error);
    return { success: false, message: `Failed to pause ${source} queue: ${errorMsg}` };
  }
}

export async function resumeQueue(source: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler') {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[source];
    if (!queue) throw new Error(`Queue ${source} not initialized`);
    await queue.resume();
    return { success: true, message: `${source} queue resumed.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to resume ${source} queue:`, error);
    return { success: false, message: `Failed to resume ${source} queue: ${errorMsg}` };
  }
}

export async function drainQueue(source: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler') {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[source];
    if (!queue) throw new Error(`Queue ${source} not initialized`);
    await queue.drain();

    // Reset Redis counters for all-time stats
    const queueNameMap: Record<string, string> = {
      'github': 'github-crawler',
      'huggingface': 'hf-crawler',
      'github-updater': 'github-updater',
      'hf-updater': 'hf-updater',
      'scheduler': 'scheduler-queue',
    };
    const queueName = queueNameMap[source];
    try {
      await Promise.all([
        redisConnection.del(`crawler:stats:${queueName}:completed`),
        redisConnection.del(`crawler:stats:${queueName}:failed`),
      ]);
    } catch (redisErr) {
      console.warn(`[Actions] Failed to reset Redis stats on drain for ${queueName}:`, redisErr);
    }

    return { success: true, message: `${source} queue drained. All waiting jobs removed and counters reset.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to drain ${source} queue:`, error);
    return { success: false, message: `Failed to drain ${source} queue: ${errorMsg}` };
  }
}

export async function retryFailedJobs(source: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler') {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[source];
    if (!queue) throw new Error(`Queue ${source} not initialized`);
    const failedJobs = await queue.getFailed(0, 100);
    let retried = 0;
    for (const job of failedJobs) {
      await job.retry();
      retried++;
    }
    return { success: true, message: `Retried ${retried} failed jobs in ${source} queue.` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to retry jobs in ${source} queue:`, error);
    return { success: false, message: `Failed to retry failed jobs: ${errorMsg}` };
  }
}

export interface RecentJob {
  id: string;
  name: string;
  data: string;
  rawData: unknown;
  queueName: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler';
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'delayed';
  timestamp: number;
  processedOn: number | null;
  finishedOn: number | null;
  failedReason: string | null;
  stacktrace: string[] | null;
}

export async function fetchRecentJobs(
  source: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler' | 'all',
  status: 'active' | 'completed' | 'failed' | 'waiting' | 'all',
  page: number = 0,
  limit: number = 10
): Promise<{ jobs: RecentJob[]; total: number }> {
  try {
    const allQueueEntries: { queue: Queue | null; label: RecentJob['queueName'] }[] = [
      { queue: crawlerQueue, label: 'github' },
      { queue: hfQueue, label: 'huggingface' },
      { queue: githubUpdaterQueue, label: 'github-updater' },
      { queue: hfUpdaterQueue, label: 'hf-updater' },
      { queue: schedulerQueue, label: 'scheduler' },
    ];

    const queues = source === 'all'
      ? allQueueEntries
      : allQueueEntries.filter(e => e.label === source);

    const allJobs: RecentJob[] = [];

    for (const { queue, label } of queues) {
      if (!queue) continue;
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
          const dataStr = (label === 'github' || label === 'github-updater')
            ? `${job.data?.owner || ''}/${job.data?.repo || ''}`
            : (label === 'huggingface' || label === 'hf-updater')
              ? `${job.data?.id || ''}`
              : 'System Task Execution';
          allJobs.push({
            id: job.id || '',
            name: job.name,
            data: dataStr,
            rawData: undefined,
            queueName: label,
            status: s,
            timestamp: job.timestamp || 0,
            processedOn: job.processedOn || null,
            finishedOn: job.finishedOn || null,
            failedReason: job.failedReason || null,
            stacktrace: null,
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

export async function retryJob(queueName: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler', jobId: string) {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not initialized`);
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in ${queueName} queue`);
    await job.retry();
    return { success: true, message: `Successfully retried job ${jobId}` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to retry job ${jobId}:`, error);
    return { success: false, message: errorMsg };
  }
}

export async function removeJob(queueName: 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler', jobId: string) {
  try {
    const queueMap: Record<string, Queue | null> = {
      'github': crawlerQueue,
      'huggingface': hfQueue,
      'github-updater': githubUpdaterQueue,
      'hf-updater': hfUpdaterQueue,
      'scheduler': schedulerQueue,
    };
    const queue = queueMap[queueName];
    if (!queue) throw new Error(`Queue ${queueName} not initialized`);
    const job = await queue.getJob(jobId);
    if (!job) throw new Error(`Job ${jobId} not found in ${queueName} queue`);
    await job.remove();
    return { success: true, message: `Successfully removed job ${jobId}` };
  } catch (error: unknown) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    console.error(`Failed to remove job ${jobId}:`, error);
    return { success: false, message: errorMsg };
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
  isActive?: boolean;
}

export async function getScheduledJobs(): Promise<ScheduledJob[]> {
  if (!schedulerQueue) return [];
  try {
    const [jobs, activeJobs] = await Promise.all([
      schedulerQueue.getRepeatableJobs(),
      schedulerQueue.getActive(),
    ]);
    const activeNames = new Set(activeJobs.map(j => j.name));
    
    return jobs.map(job => ({
      key: job.key,
      name: job.name,
      id: job.id || '',
      endDate: job.endDate || null,
      tz: job.tz || null,
      pattern: job.pattern || '',
      next: job.next || 0,
      isActive: activeNames.has(job.name),
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
    await schedulerQueue.add(name, { force: true }, { jobId: `manual-${name}-${Date.now()}` });

    // Auto-resume downstream queues so jobs get processed immediately (1-click UX)
    if (name === 'daily-update') {
      await Promise.all([
        githubUpdaterQueue.resume(),
        hfUpdaterQueue.resume(),
      ]);
    } else if (name === 'daily-discovery') {
      await Promise.all([
        crawlerQueue.resume(),
        hfQueue.resume(),
      ]);
    }

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

export async function fetchGithubTokensHealth() {
  try {
    return await githubPool.getTokenHealth();
  } catch (error) {
    console.error('Failed to fetch github tokens health:', error);
    return [];
  }
}

export async function fetchHuggingFaceTokenHealth() {
  try {
    const infoStr = await redisConnection.hget('system:hf:token', 'info');
    if (!infoStr) return null;
    return JSON.parse(infoStr);
  } catch (error) {
    console.error('Failed to fetch HuggingFace token health from Redis:', error);
    return null;
  }
}

export async function getCommonCrawlErrors() {
  const queues = [
    { queue: crawlerQueue, name: 'github-crawler' },
    { queue: hfQueue, name: 'hf-crawler' },
    { queue: githubUpdaterQueue, name: 'github-updater' },
    { queue: hfUpdaterQueue, name: 'hf-updater' }
  ];
  const errorCounts: Record<string, number> = {};
  
  for (const { queue } of queues) {
    if (!queue) continue;
    try {
      const failedJobs = await queue.getFailed(0, 50);
      for (const job of failedJobs) {
        if (job.failedReason) {
          let reason = job.failedReason;
          if (reason.includes('rate limit') || reason.includes('429') || reason.includes('exhausted')) {
            reason = 'API Rate Limit Exceeded (429)';
          } else if (reason.includes('404') || reason.includes('Not Found')) {
            reason = 'Not Found (404)';
          } else if (reason.includes('ECONNRESET') || reason.includes('ETIMEDOUT') || reason.includes('fetch failed')) {
            reason = 'Network Timeout / Connection Reset';
          } else if (reason.includes('invalid') || reason.includes('format')) {
            reason = 'Invalid Data Format';
          } else {
            reason = reason.substring(0, 50) + (reason.length > 50 ? '...' : '');
          }
          errorCounts[reason] = (errorCounts[reason] || 0) + 1;
        }
      }
    } catch (err) {
      console.error('Failed to get failed jobs for stats:', err);
    }
  }

  return Object.entries(errorCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);
}

export async function fetchAnalyticsData() {
  try {
    const stats = await getDatabaseStorageStats();
    const categories = await getCategoryStats();
    const languages = await getLanguageStats();
    const staleness = await getDataStalenessStats();
    const commonErrors = await getCommonCrawlErrors();
    
    interface WorkerStats {
      rss: number;
      heapUsed: number;
      heapTotal: number;
      timestamp: number;
    }
    const workersMemory: Record<string, WorkerStats> = {};
    try {
      const rawMem = await redisConnection.hgetall('system:worker:memory');
      const now = Date.now();
      for (const [workerName, dataStr] of Object.entries(rawMem)) {
        const data = JSON.parse(dataStr);
        // Mark stale if no update in 45 seconds (worker went offline)
        if (now - data.timestamp < 45000) {
          workersMemory[workerName] = data;
        } else {
          // Auto-clean stale data from Redis
          await redisConnection.hdel('system:worker:memory', workerName);
        }
      }
    } catch (err) {
      console.warn("Failed to read worker memory stats:", err);
    }

    // Add Next.js server memory stats
    const nextjsMemory = process.memoryUsage();
    workersMemory['nextjs-server'] = {
      rss: nextjsMemory.rss,
      heapUsed: nextjsMemory.heapUsed,
      heapTotal: nextjsMemory.heapTotal,
      timestamp: Date.now()
    };

    // Basic OS stats
    const osMetrics = {
      platform: os.platform(),
      uptime: os.uptime(),
      totalMem: os.totalmem(),
      freeMem: os.freemem(),
      loadAvg: os.loadavg(),
    };

    return {
      success: true,
      stats,
      categories: categories.slice(0, 10), // Top 10 categories
      languages: languages.slice(0, 10),   // Top 10 languages
      staleness,
      commonErrors,
      systemMetrics: {
        workers: workersMemory,
        os: osMetrics
      }
    };
  } catch (error) {
    console.error("Failed to fetch analytics data:", error);
    return {
      success: false,
      stats: {
        totalProjects: 0,
        projectsWithReadme: 0,
        compressedSize: 0,
        estimatedRawSize: 0,
        savedSize: 0,
        postgresDbSize: 0,
      },
      categories: [],
      languages: [],
      staleness: {
        total: 0,
        fresh24h: 0,
        stale24h: 0,
        stale48h: 0,
        freshPercent: 0,
        stale24hPercent: 0,
        stale48hPercent: 0,
      },
      commonErrors: [],
      systemMetrics: {
        workers: {},
        os: {
          platform: 'unknown',
          uptime: 0,
          totalMem: 0,
          freeMem: 0,
          loadAvg: [0, 0, 0]
        }
      }
    };
  }
}


