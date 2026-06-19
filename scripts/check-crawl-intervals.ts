import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("=== Crawl Interval Distribution ===");
  try {
    const distribution = await db.execute(sql`
      SELECT 
        source, 
        COALESCE(crawl_interval, 1) as crawl_interval, 
        COUNT(*) as count
      FROM projects
      GROUP BY source, COALESCE(crawl_interval, 1)
      ORDER BY source, crawl_interval;
    `);
    console.table(distribution);

    // Let's also check how many are due to crawl today vs future days
    const crawlSchedule = await db.execute(sql`
      SELECT 
        source,
        COUNT(*) FILTER (WHERE next_crawl_at IS NULL OR next_crawl_at <= NOW()) as due_now,
        COUNT(*) FILTER (WHERE next_crawl_at > NOW() AND next_crawl_at <= NOW() + INTERVAL '1 day') as due_in_1d,
        COUNT(*) FILTER (WHERE next_crawl_at > NOW() + INTERVAL '1 day' AND next_crawl_at <= NOW() + INTERVAL '7 days') as due_in_7d,
        COUNT(*) FILTER (WHERE next_crawl_at > NOW() + INTERVAL '7 days') as due_later
      FROM projects
      GROUP BY source;
    `);
    console.log("\n=== Crawl Schedule Breakdown ===");
    console.table(crawlSchedule);
  } catch (err) {
    console.error(err);
  }
  process.exit(0);
}

main().catch(console.error);
