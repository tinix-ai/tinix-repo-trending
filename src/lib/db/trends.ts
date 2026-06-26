import { db } from './index';
import { sql } from 'drizzle-orm';

/**
 * Calculates and updates trends (stars/likes and downloads) inline for a specific project.
 * Uses conditional logic based on the project's source ('github' or 'huggingface')
 * to choose between 'stars' and 'likes' respectively, avoiding the COALESCE default 0 bug.
 */
export async function calculateProjectTrendInline(projectId: string) {
  try {
    await db.execute(sql`
      WITH project_source AS (
        SELECT source FROM projects WHERE id = ${projectId}::uuid
      ),
      current_snap AS (
        SELECT 
          CASE WHEN ps.source = 'github' THEN s.stars ELSE s.likes END as stars, 
          s.downloads, 
          s.snapshot_date
        FROM project_snapshots s
        CROSS JOIN project_source ps
        WHERE s.project_id = ${projectId}::uuid
        ORDER BY s.snapshot_date DESC
        LIMIT 1
      )
      INSERT INTO project_trends (
        project_id, 
        daily_stars, weekly_stars, monthly_stars, 
        daily_downloads, weekly_downloads, monthly_downloads,
        updated_at
      )
      SELECT 
        ${projectId}::uuid,
        CASE WHEN d.stars > 0 THEN COALESCE(c.stars - d.stars, 0) ELSE 0 END as daily_stars,
        CASE WHEN w.stars > 0 THEN COALESCE(c.stars - w.stars, 0) ELSE 0 END as weekly_stars,
        CASE WHEN m.stars > 0 THEN COALESCE(c.stars - m.stars, 0) ELSE 0 END as monthly_stars,
        CASE WHEN d.downloads > 0 THEN COALESCE(c.downloads - d.downloads, 0) ELSE 0 END as daily_downloads,
        CASE WHEN w.downloads > 0 THEN COALESCE(c.downloads - w.downloads, 0) ELSE 0 END as weekly_downloads,
        CASE WHEN m.downloads > 0 THEN COALESCE(c.downloads - m.downloads, 0) ELSE 0 END as monthly_downloads,
        NOW() as updated_at
      FROM current_snap c
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN ps.source = 'github' THEN s.stars ELSE s.likes END as stars, 
          s.downloads 
        FROM project_snapshots s
        CROSS JOIN project_source ps
        WHERE s.project_id = ${projectId}::uuid AND s.snapshot_date <= (c.snapshot_date - INTERVAL '1 day')::date
        ORDER BY s.snapshot_date DESC LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN ps.source = 'github' THEN s.stars ELSE s.likes END as stars, 
          s.downloads 
        FROM project_snapshots s
        CROSS JOIN project_source ps
        WHERE s.project_id = ${projectId}::uuid AND s.snapshot_date <= (c.snapshot_date - INTERVAL '7 days')::date
        ORDER BY s.snapshot_date DESC LIMIT 1
      ) w ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN ps.source = 'github' THEN s.stars ELSE s.likes END as stars, 
          s.downloads 
        FROM project_snapshots s
        CROSS JOIN project_source ps
        WHERE s.project_id = ${projectId}::uuid AND s.snapshot_date <= (c.snapshot_date - INTERVAL '30 days')::date
        ORDER BY s.snapshot_date DESC LIMIT 1
      ) m ON true
      ON CONFLICT (project_id) DO UPDATE SET
        daily_stars = EXCLUDED.daily_stars,
        weekly_stars = EXCLUDED.weekly_stars,
        monthly_stars = EXCLUDED.monthly_stars,
        daily_downloads = EXCLUDED.daily_downloads,
        weekly_downloads = EXCLUDED.weekly_downloads,
        monthly_downloads = EXCLUDED.monthly_downloads,
        updated_at = EXCLUDED.updated_at;
    `);

    console.log(`[Trends] Inline Trend Calculation completed for project: ${projectId}`);
  } catch (error) {
    console.error(`[Trends] Error running inline trend calculation for ${projectId}:`, error);
  }
}
