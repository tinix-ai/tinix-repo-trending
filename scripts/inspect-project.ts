import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { like } from 'drizzle-orm';

async function main() {
  const result = await db.select({
    id: projects.id,
    slug: projects.slug,
    name: projects.name,
  })
  .from(projects)
  .where(like(projects.slug, '%prompts%'));

  for (const p of result) {
    console.log(`SLUG: ${p.slug}, ID: ${p.id}`);
  }
  process.exit(0);
}

main().catch(console.error);
