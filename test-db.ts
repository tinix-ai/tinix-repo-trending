import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const snapshots = await db.execute(sql`
    SELECT project_id, stars, likes, downloads, snapshot_date
    FROM project_snapshots
    ORDER BY project_id, snapshot_date DESC
    LIMIT 20
  `);
  console.log('Sample snapshots:', snapshots);
  
  const dates = await db.execute(sql`
    SELECT snapshot_date, count(*)
    FROM project_snapshots
    GROUP BY snapshot_date
    ORDER BY snapshot_date DESC
  `);
  console.log('Snapshot dates:', dates);
  
  const hfSample = await db.execute(sql`
    SELECT p.name, t.daily_downloads, t.weekly_downloads, t.monthly_downloads
    FROM projects p
    JOIN project_trends t ON p.id = t.project_id
    WHERE p.source = 'huggingface'
    LIMIT 5
  `);
  console.log('HF Trends Sample:', hfSample);
  
  process.exit(0);
}
main();
