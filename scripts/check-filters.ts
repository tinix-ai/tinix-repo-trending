import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log('--- Checking database filter options ---');

  // Check countries count and check for 'vn'
  const countryCounts = await db.execute(sql`
    SELECT country_code, COUNT(*) as count
    FROM projects
    WHERE country_code IS NOT NULL AND country_code != ''
    GROUP BY country_code
    ORDER BY count DESC
  `);
  console.log(`Total unique countries in DB: ${countryCounts.length}`);
  console.log('Top 15 countries:');
  console.log(countryCounts.slice(0, 15));

  const vnCount = countryCounts.find(c => String(c.country_code).toLowerCase() === 'vn');
  console.log('Vietnam (VN) count:', vnCount);

  // Check topics containing 'video'
  const videoTopics = await db.execute(sql`
    SELECT t.topic as name, COUNT(*) as count
    FROM projects p,
    LATERAL jsonb_array_elements_text(p.topics) t(topic)
    WHERE p.topics IS NOT NULL 
      AND jsonb_typeof(p.topics) = 'array'
      AND t.topic ILIKE '%video%'
    GROUP BY t.topic
    ORDER BY count DESC
  `);
  console.log('Topics containing "video":', videoTopics);
}

main().catch(console.error);
