import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('--- Inspecting projects details for gakonst/ethers-rs ---');
  try {
    const res = await db.execute(sql`
      SELECT id, name, full_name, created_at, last_crawled_at, crawl_interval, next_crawl_at 
      FROM projects 
      WHERE id = '7acd5b39-1650-4cdd-ab87-793b5a0287cf'::uuid
    `);
    console.log(res);
  } catch (err) {
    console.error('Error:', err);
  }
  process.exit(0);
}

main();
