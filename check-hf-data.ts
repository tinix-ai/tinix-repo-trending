import 'dotenv/config';
import { db } from './src/lib/db';
import { projectSnapshots } from './src/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

async function main() {
  const projectId = 'b052d2bb-1a7f-4df0-87b0-368c2b17a689';
  console.log(`--- Fetching ALL snapshots for project ${projectId} ---`);
  
  const snaps = await db.select({
    id: projectSnapshots.id,
    snapshotDate: projectSnapshots.snapshotDate,
    stars: projectSnapshots.stars,
    likes: projectSnapshots.likes,
    downloads: projectSnapshots.downloads
  })
  .from(projectSnapshots)
  .where(eq(projectSnapshots.projectId, projectId))
  .orderBy(sql`${projectSnapshots.snapshotDate} DESC`);

  console.table(snaps);
}

main().catch(console.error);
