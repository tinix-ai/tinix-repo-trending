import { db } from "../db";
import { projects, projectSnapshots } from "../db/schema";
import { eq, desc } from "drizzle-orm";

/**
  * Calculates growth velocity and schedules the next crawl for a project.
  * @param projectId UUID of the project
  * @param source 'github' | 'huggingface'
  */
export async function updateProjectCrawlSchedule(
  projectId: string,
  source: "github" | "huggingface"
): Promise<void> {
  console.log(`[Scheduler] Recalculating crawl schedule for project ${projectId} (${source})...`);
  
  try {
    // Fetch the current project to check its existing crawlInterval
    const [project] = await db
      .select({ crawlInterval: projects.crawlInterval })
      .from(projects)
      .where(eq(projects.id, projectId));
      
    const currentInterval = project?.crawlInterval || 1;

    // Fetch the 2 latest snapshots
    const snapshots = await db
      .select()
      .from(projectSnapshots)
      .where(eq(projectSnapshots.projectId, projectId))
      .orderBy(desc(projectSnapshots.snapshotDate))
      .limit(2);

    let crawlInterval = 1; // Default to 1 day

    if (snapshots.length >= 2) {
      const latest = snapshots[0];
      const previous = snapshots[1];

      if (source === "github") {
        const deltaStars = (latest.stars || 0) - (previous.stars || 0);
        console.log(`[Scheduler] GitHub project ${projectId} star delta: ${deltaStars}`);
        
        if (deltaStars >= 100) {
          crawlInterval = 1; // High growth: crawl daily
        } else if (deltaStars >= 50) {
          crawlInterval = 2; // Moderate growth: crawl every 2 days
        } else if (deltaStars >= 10) {
          crawlInterval = 4; // Slow growth: crawl every 4 days
        } else if (deltaStars > 0) {
          crawlInterval = 7; // Low growth: crawl weekly
        } else {
          // No growth (deltaStars <= 0)
          if (currentInterval < 7) {
            crawlInterval = 7; // 1 week
          } else if (currentInterval === 7) {
            crawlInterval = 14; // 2 weeks
          } else {
            crawlInterval = 30; // 1 month
          }
        }
      } else if (source === "huggingface") {
        const deltaLikes = (latest.likes || 0) - (previous.likes || 0);
        const deltaDownloads = (latest.downloads || 0) - (previous.downloads || 0);
        console.log(
          `[Scheduler] HF project ${projectId} delta likes: ${deltaLikes}, downloads: ${deltaDownloads}`
        );

        if (deltaLikes >= 50 || deltaDownloads >= 5000) {
          crawlInterval = 1; // High growth
        } else if (deltaLikes >= 20 || deltaDownloads >= 1000) {
          crawlInterval = 2; // Moderate growth
        } else if (deltaLikes >= 5 || deltaDownloads >= 200) {
          crawlInterval = 4; // Slow growth
        } else if (deltaLikes > 0 || deltaDownloads > 0) {
          crawlInterval = 7; // Low growth
        } else {
          // No growth (deltaLikes <= 0 and deltaDownloads <= 0)
          if (currentInterval < 7) {
            crawlInterval = 7; // 1 week
          } else if (currentInterval === 7) {
            crawlInterval = 14; // 2 weeks
          } else {
            crawlInterval = 30; // 1 month
          }
        }
      }
    } else {
      console.log(`[Scheduler] Not enough snapshots (${snapshots.length}) for project ${projectId}. Scheduling next crawl in 1 day.`);
    }

    const nextCrawlAt = new Date(Date.now() + crawlInterval * 24 * 60 * 60 * 1000);
    
    await db
      .update(projects)
      .set({
        crawlInterval,
        nextCrawlAt,
        lastCrawledAt: new Date(),
      })
      .where(eq(projects.id, projectId));

    console.log(
      `[Scheduler] Scheduled project ${projectId}: interval = ${crawlInterval} day(s), next crawl = ${nextCrawlAt.toISOString()}`
    );
  } catch (error) {
    console.error(`[Scheduler] Failed to update crawl schedule for project ${projectId}:`, error);
  }
}
