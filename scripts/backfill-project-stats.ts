import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('[Backfill Stats] Starting BULK backfill of denormalized project metrics...');
  
  try {
    const query = sql`
      UPDATE projects p
      SET 
        stars = COALESCE(latest.stars, 0),
        forks = COALESCE(latest.forks, 0),
        watchers = COALESCE(latest.watchers, 0),
        open_issues = COALESCE(latest.open_issues, 0),
        downloads = COALESCE(latest.downloads, 0),
        likes = COALESCE(latest.likes, 0),
        contributors_count = COALESCE(latest.contributors_count, 0),
        updated_at = NOW()
      FROM (
        SELECT DISTINCT ON (project_id) 
          project_id, stars, forks, watchers, open_issues, downloads, likes, contributors_count
        FROM project_snapshots
        ORDER BY project_id, snapshot_date DESC, created_at DESC
      ) latest
      WHERE p.id = latest.project_id;
    `;

    console.log('[Backfill Stats] Executing bulk UPDATE statement on PostgreSQL...');
    const startTime = Date.now();
    const result = await db.execute(query);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`[Backfill Stats] Successfully completed bulk update in ${duration}s!`);
    console.log(`[Backfill Stats] Database returned:`, result);
  } catch (error) {
    console.error('[Backfill Stats] Error running bulk backfill:', error);
  } finally {
    process.exit(0);
  }
}

main();
