import { db } from './db';
import { sql } from 'drizzle-orm';

export async function evaluateAndRecordAchievements() {
  console.log('[Achievements] Starting achievement evaluation...');
  try {
    // 1. Find the latest completed snapshot date (strictly older than today)
    const [dateRes]: any = await db.execute(sql`
      SELECT MAX(snapshot_date)::text as max_date 
      FROM project_snapshots 
      WHERE snapshot_date < CURRENT_DATE
    `);
    
    const targetDate = dateRes?.max_date;
    if (!targetDate) {
      console.warn('[Achievements] No completed snapshot date found to calculate achievements.');
      return;
    }
    
    console.log(`[Achievements] Evaluating achievements for completed date: ${targetDate}`);
    
    const scopes = ['daily', 'weekly', 'monthly'];
    
    for (const period of scopes) {
      const interval = period === 'daily' ? '1 day' : period === 'weekly' ? '7 days' : '30 days';

      // Generate Top 3 overall (global) and Top 3 per primary_language
      // We join current snapshots with past snapshots (offset by the period interval).
      // The INNER JOIN automatically guarantees we only evaluate projects with sufficient historical data.
      await db.execute(sql`
        INSERT INTO project_achievements (id, project_id, achievement_type, rank, scope, period, achieved_at)
        WITH current_snaps AS (
          SELECT project_id, stars, likes, downloads
          FROM project_snapshots
          WHERE snapshot_date = ${targetDate}::date
        ),
        past_snaps AS (
          SELECT project_id, stars, likes, downloads
          FROM project_snapshots
          WHERE snapshot_date = (${targetDate}::date - ${interval}::interval)::date
        ),
        deltas AS (
          SELECT 
            p.id as project_id,
            COALESCE(p.primary_language, 'Unknown') as primary_language,
            p.source,
            c.stars as snap_stars,
            c.likes as snap_likes,
            c.downloads as snap_downloads,
            
            GREATEST(COALESCE(
              CASE 
                WHEN p.source = 'github' THEN c.stars - old.stars 
                ELSE c.likes - old.likes 
              END, 0), 0) as stars_gained,
            GREATEST(COALESCE(c.downloads - old.downloads, 0), 0) as downloads_gained
          FROM projects p
          INNER JOIN current_snaps c ON p.id = c.project_id
          INNER JOIN past_snaps old ON p.id = old.project_id
        ),
        scored AS (
          SELECT 
            *,
            CASE 
              WHEN source = 'github' THEN LN(stars_gained + 1) * 15.0
              WHEN source = 'huggingface' THEN LN(downloads_gained + 1) * 2.5
              ELSE 0 
            END as momentum_score
          FROM deltas
          WHERE (stars_gained > 0 OR downloads_gained > 0)
        ),
        ranked_global AS (
          SELECT 
            project_id, 
            ROW_NUMBER() OVER(
              ORDER BY momentum_score DESC, 
              (CASE WHEN source = 'github' THEN COALESCE(snap_stars, 0) ELSE COALESCE(snap_likes, 0) * 5.0 + (COALESCE(snap_downloads, 0) / 1000.0) END) DESC
            ) as rank
          FROM scored
        ),
        ranked_language AS (
          SELECT 
            project_id,
            primary_language,
            ROW_NUMBER() OVER(
              PARTITION BY primary_language 
              ORDER BY momentum_score DESC, 
              (CASE WHEN source = 'github' THEN COALESCE(snap_stars, 0) ELSE COALESCE(snap_likes, 0) * 5.0 + (COALESCE(snap_downloads, 0) / 1000.0) END) DESC
            ) as rank
          FROM scored
          WHERE primary_language != 'Unknown'
        ),
        new_achievements AS (
          -- Top 3 Global
          SELECT 
            gen_random_uuid() as id,
            project_id,
            'rank_' || rank || '_' || ${period} as achievement_type,
            rank,
            'global' as scope,
            ${period} as period,
            ${targetDate}::date as achieved_at
          FROM ranked_global
          WHERE rank <= 3

          UNION ALL

          -- Top 3 Per Language
          SELECT 
            gen_random_uuid() as id,
            project_id,
            'rank_' || rank || '_' || ${period} || '_language' as achievement_type,
            rank,
            'language:' || primary_language as scope,
            ${period} as period,
            ${targetDate}::date as achieved_at
          FROM ranked_language
          WHERE rank <= 3
        )
        SELECT * FROM new_achievements
        ON CONFLICT (project_id, achievement_type, scope, period, achieved_at) DO NOTHING;
      `);
      
      console.log(`[Achievements] Processed ${period} achievements for completed date ${targetDate}.`);
    }
  } catch (error) {
    console.error("[Achievements] Error evaluating achievements:", error);
  }
}
