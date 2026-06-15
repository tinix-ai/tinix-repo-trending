import 'dotenv/config';
import { db } from './src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const res = await db.execute(sql`
    SELECT column_name
    FROM information_schema.columns
    WHERE table_name = 'projects';
  `);
  console.log(res.map(r => r.column_name));
  process.exit(0);
}
main();
