import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function cleanupFakeTwitterData() {
  console.log('=== Cleanup Fake Twitter/X Data ===\n');

  // Count before deletion
  const before = await db.execute(sql`SELECT COUNT(*) as count FROM project_mentions WHERE source = 'x'`);
  const count = (before as unknown as { count: string }[])[0]?.count || '0';
  console.log(`Found ${count} fake X/Twitter mentions to delete.`);

  if (parseInt(count) === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  // Delete all fake X data
  await db.execute(sql`DELETE FROM project_mentions WHERE source = 'x'`);
  console.log(`✅ Deleted ${count} fake X/Twitter mentions.`);

  // Verify
  const after = await db.execute(sql`SELECT COUNT(*) as count FROM project_mentions WHERE source = 'x'`);
  const remaining = (after as unknown as { count: string }[])[0]?.count || '0';
  console.log(`Remaining X mentions: ${remaining}`);

  process.exit(0);
}

cleanupFakeTwitterData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
