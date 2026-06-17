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

      // Calculate the difference in days between snapshots
      const latestDate = new Date(latest.snapshotDate);
      const previousDate = new Date(previous.snapshotDate);
      const diffTime = Math.abs(latestDate.getTime() - previousDate.getTime());
      const diffDays = Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24)));

      if (source === "github") {
        const deltaStars = (latest.stars || 0) - (previous.stars || 0);
        const dailyStarsRate = deltaStars / diffDays;
        console.log(
          `[Scheduler] GitHub project ${projectId}: delta stars = ${deltaStars}, diff days = ${diffDays}, daily growth rate = ${dailyStarsRate.toFixed(2)}`
        );
        
        if (dailyStarsRate >= 100) {
          crawlInterval = 1; // High growth: crawl daily
        } else if (dailyStarsRate >= 50) {
          crawlInterval = 2; // Moderate growth: crawl every 2 days
        } else if (dailyStarsRate >= 10) {
          crawlInterval = 4; // Slow growth: crawl every 4 days
        } else if (dailyStarsRate > 0) {
          crawlInterval = 7; // Low growth: crawl weekly
        } else {
          // No growth (dailyStarsRate <= 0)
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
        const dailyLikesRate = deltaLikes / diffDays;
        const dailyDownloadsRate = deltaDownloads / diffDays;
        console.log(
          `[Scheduler] HF project ${projectId}: delta likes = ${deltaLikes}, downloads = ${deltaDownloads}, diff days = ${diffDays}, daily likes rate = ${dailyLikesRate.toFixed(2)}, daily downloads rate = ${dailyDownloadsRate.toFixed(2)}`
        );

        if (dailyLikesRate >= 50 || dailyDownloadsRate >= 5000) {
          crawlInterval = 1; // High growth
        } else if (dailyLikesRate >= 20 || dailyDownloadsRate >= 1000) {
          crawlInterval = 2; // Moderate growth
        } else if (dailyLikesRate >= 5 || dailyDownloadsRate >= 200) {
          crawlInterval = 4; // Slow growth
        } else if (dailyLikesRate > 0 || dailyDownloadsRate > 0) {
          crawlInterval = 7; // Low growth
        } else {
          // No growth (dailyLikesRate <= 0 and dailyDownloadsRate <= 0)
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
