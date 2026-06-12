import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.time("Languages query");
  const langs = await db.execute(sql`
    SELECT primary_language as name, COUNT(*) as count
    FROM projects
    WHERE source = 'github' AND primary_language IS NOT NULL AND primary_language != ''
    GROUP BY primary_language
    ORDER BY count DESC
    LIMIT 20;
  `);
  console.timeEnd("Languages query");

  console.time("Topics query");
  const topicsResult = await db.execute(sql`
    SELECT t.topic as name, COUNT(*) as count
    FROM projects p,
    LATERAL jsonb_array_elements_text(p.topics) t(topic)
    WHERE p.topics IS NOT NULL 
      AND jsonb_typeof(p.topics) = 'array'
      AND t.topic NOT LIKE '%:%'
      AND LENGTH(t.topic) > 2
      AND t.topic NOT IN ('en', 'zh', 'fr', 'ja', 'ko', 'es', 'de', 'pt', 'it', 'ru')
    GROUP BY t.topic
    ORDER BY count DESC
    LIMIT 20;
  `);
  console.timeEnd("Topics query");

  console.log("\nTop Languages (GitHub):");
  console.log(langs);

  console.log("\nTop Topics (topics column):");
  console.log(topicsResult);

  process.exit(0);
}

main().catch(console.error);






