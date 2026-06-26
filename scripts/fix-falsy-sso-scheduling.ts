import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects, projectSnapshots } from '../src/lib/db/schema';
import { eq, and, sql } from 'drizzle-orm';

async function main() {
  console.log('--- Starting Correction of Falsely Restricted Projects (RESOURCE_LIMITS_EXCEEDED) ---');
  
  try {
    // 1. Identify projects to reset
    // We search for GitHub projects that:
    // - are marked with crawl_interval = 30
    // - were crawled on 2026-06-25 (today)
    // - but DO NOT have a project snapshot for '2026-06-25'
    const targetSnapshotDate = '2026-06-25';
    
    console.log(`Searching for projects crawled on ${targetSnapshotDate} with crawl_interval = 30 but without a snapshot...`);
    
    const targets = await db.execute(sql`
      SELECT p.id, p.full_name, p.last_crawled_at, p.next_crawl_at
      FROM projects p
      LEFT JOIN project_snapshots ps ON p.id = ps.project_id AND ps.snapshot_date = ${targetSnapshotDate}
      WHERE p.source = 'github'
        AND p.crawl_interval = 30
        AND p.last_crawled_at::date = ${targetSnapshotDate}::date
        AND ps.id IS NULL
    `) as any[];
    
    console.log(`Found ${targets.length} projects that fit the criteria.`);
    
    if (targets.length === 0) {
      console.log('No projects to correct. Exiting.');
      process.exit(0);
    }
    
    // 2. Perform the update
    console.log('Resetting crawl_interval = 1 and next_crawl_at to NOW() so they are queued for update again with correct priority...');
    
    const targetIds = targets.map(t => t.id);
    
    // Update next_crawl_at to current time and crawl_interval to 1 for these projects
    const batchSize = 1000;
    let updatedCount = 0;
    
    for (let i = 0; i < targetIds.length; i += batchSize) {
      const batchIds = targetIds.slice(i, i + batchSize);
      await db.execute(sql`
        UPDATE projects
        SET next_crawl_at = NOW(),
            crawl_interval = 1
        WHERE id IN (${sql.join(batchIds.map(id => sql`${id}::uuid`), sql`, `)})
      `);
      updatedCount += batchIds.length;
      console.log(`Updated ${updatedCount}/${targetIds.length} projects...`);
    }
    
    console.log('--- Correction completed successfully ---');
  } catch (error) {
    console.error('Error during correction:', error);
  }
  process.exit(0);
}

main().catch(console.error);
