import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('--- Starting Bulk Recalculation of Project Trends ---');
  console.log('Running query to recalculate all 100k+ project trends at once...');

  const startTime = Date.now();
  try {
    const result = await db.execute(sql`
      INSERT INTO project_trends (
        project_id, 
        daily_stars, weekly_stars, monthly_stars, 
        daily_downloads, weekly_downloads, monthly_downloads,
        updated_at
      )
      SELECT 
        p.id as project_id,
        CASE WHEN d.stars > 0 THEN COALESCE(c.stars - d.stars, 0) ELSE 0 END as daily_stars,
        CASE WHEN w.stars > 0 THEN COALESCE(c.stars - w.stars, 0) ELSE 0 END as weekly_stars,
        CASE WHEN m.stars > 0 THEN COALESCE(c.stars - m.stars, 0) ELSE 0 END as monthly_stars,
        CASE WHEN d.downloads > 0 THEN COALESCE(c.downloads - d.downloads, 0) ELSE 0 END as daily_downloads,
        CASE WHEN w.downloads > 0 THEN COALESCE(c.downloads - w.downloads, 0) ELSE 0 END as weekly_downloads,
        CASE WHEN m.downloads > 0 THEN COALESCE(c.downloads - m.downloads, 0) ELSE 0 END as monthly_downloads,
        NOW() as updated_at
      FROM projects p
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN p.source = 'github' THEN stars ELSE likes END as stars, 
          downloads, 
          snapshot_date
        FROM project_snapshots
        WHERE project_id = p.id
        ORDER BY snapshot_date DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN p.source = 'github' THEN stars ELSE likes END as stars, 
          downloads 
        FROM project_snapshots 
        WHERE project_id = p.id AND snapshot_date <= (c.snapshot_date - INTERVAL '1 day')::date
        ORDER BY snapshot_date DESC LIMIT 1
      ) d ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN p.source = 'github' THEN stars ELSE likes END as stars, 
          downloads 
        FROM project_snapshots 
        WHERE project_id = p.id AND snapshot_date <= (c.snapshot_date - INTERVAL '7 days')::date
        ORDER BY snapshot_date DESC LIMIT 1
      ) w ON true
      LEFT JOIN LATERAL (
        SELECT 
          CASE WHEN p.source = 'github' THEN stars ELSE likes END as stars, 
          downloads 
        FROM project_snapshots 
        WHERE project_id = p.id AND snapshot_date <= (c.snapshot_date - INTERVAL '30 days')::date
        ORDER BY snapshot_date DESC LIMIT 1
      ) m ON true
      ON CONFLICT (project_id) DO UPDATE SET
        daily_stars = EXCLUDED.daily_stars,
        weekly_stars = EXCLUDED.weekly_stars,
        monthly_stars = EXCLUDED.monthly_stars,
        daily_downloads = EXCLUDED.daily_downloads,
        weekly_downloads = EXCLUDED.weekly_downloads,
        monthly_downloads = EXCLUDED.monthly_downloads,
        updated_at = EXCLUDED.updated_at
    `);
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`Successfully recalculated all trends in ${duration} seconds.`);
  } catch (err) {
    console.error('Error recalculating trends:', err);
  }
  process.exit(0);
}

main().catch(console.error);
