import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("=== Active Projects Growth Analysis ===");

  // 1. Total projects
  const totalRes = await db.execute(sql`SELECT COUNT(*) as count FROM projects`);
  console.log(`Total projects: ${totalRes[0].count}`);

  // 2. Stars/likes >= 100
  const qualRes = await db.execute(sql`
    WITH latest_snapshots AS (
      SELECT DISTINCT ON (project_id) project_id, stars, likes
      FROM project_snapshots
      ORDER BY project_id, snapshot_date DESC
    )
    SELECT COUNT(*) as count
    FROM projects p
    JOIN latest_snapshots s ON p.id = s.project_id
    WHERE (p.source = 'github' AND COALESCE(s.stars, 0) >= 100)
       OR (p.source = 'huggingface' AND COALESCE(s.likes, 0) >= 100)
  `);
  console.log(`Stars/likes >= 100 (current filter): ${qualRes[0].count}`);

  // 3. Weekly growth > 0
  const growth1Res = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM projects p
    JOIN project_trends t ON p.id = t.project_id
    WHERE (p.source = 'github' AND t.weekly_stars > 0)
       OR (p.source = 'huggingface' AND (t.weekly_stars > 0 OR t.weekly_downloads > 0))
  `);
  console.log(`Weekly growth > 0: ${growth1Res[0].count}`);

  // 4. Weekly growth >= 5 stars or >= 10 downloads
  const growth5Res = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM projects p
    JOIN project_trends t ON p.id = t.project_id
    WHERE (p.source = 'github' AND t.weekly_stars >= 5)
       OR (p.source = 'huggingface' AND (t.weekly_stars >= 5 OR t.weekly_downloads >= 10))
  `);
  console.log(`Weekly growth >= 5 stars / 10 downloads: ${growth5Res[0].count}`);

  // 5. Weekly growth >= 10 stars or >= 50 downloads
  const growth10Res = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM projects p
    JOIN project_trends t ON p.id = t.project_id
    WHERE (p.source = 'github' AND t.weekly_stars >= 10)
       OR (p.source = 'huggingface' AND (t.weekly_stars >= 10 OR t.weekly_downloads >= 50))
  `);
  console.log(`Weekly growth >= 10 stars / 50 downloads: ${growth10Res[0].count}`);

  // 6. Weekly growth >= 20 stars or >= 100 downloads
  const growth20Res = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM projects p
    JOIN project_trends t ON p.id = t.project_id
    WHERE (p.source = 'github' AND t.weekly_stars >= 20)
       OR (p.source = 'huggingface' AND (t.weekly_stars >= 20 OR t.weekly_downloads >= 100))
  `);
  console.log(`Weekly growth >= 20 stars / 100 downloads: ${growth20Res[0].count}`);

  process.exit(0);
}

main().catch(console.error);
