import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { sql } from 'drizzle-orm';

async function main() {
  try {
    const counts = await db.execute(sql`
      SELECT 
        source, 
        COUNT(*) as total,
        COUNT(last_crawled_at) as crawled,
        MIN(last_crawled_at) as oldest_crawl,
        MAX(last_crawled_at) as newest_crawl,
        COUNT(*) FILTER (WHERE next_crawl_at IS NULL OR next_crawl_at <= NOW()) as pending_crawl
      FROM projects
      GROUP BY source;
    `);

    console.log('--- Database Crawl Status ---');
    console.table(counts);

    const latest = await db.execute(sql`
      SELECT name, source, last_crawled_at, next_crawl_at
      FROM projects
      WHERE last_crawled_at IS NOT NULL
      ORDER BY last_crawled_at DESC
      LIMIT 5;
    `);
    console.log('\n--- 5 Most Recently Crawled Projects ---');
    console.table(latest);

  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main();
