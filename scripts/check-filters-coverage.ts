import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkCoverage() {
  console.log('=== COUNTRY CODE COVERAGE ===');
  
  const totalProjects = await db.execute(sql`SELECT COUNT(*) as total FROM projects`);
  const withCountry = await db.execute(sql`SELECT COUNT(*) as total FROM projects WHERE country_code IS NOT NULL AND country_code != 'UNKNOWN'`);
  const withUnknown = await db.execute(sql`SELECT COUNT(*) as total FROM projects WHERE country_code = 'UNKNOWN'`);
  const withNull = await db.execute(sql`SELECT COUNT(*) as total FROM projects WHERE country_code IS NULL`);
  
  console.log(`Total projects: ${(totalProjects as any)[0].total}`);
  console.log(`With valid country_code: ${(withCountry as any)[0].total}`);
  console.log(`With UNKNOWN country_code: ${(withUnknown as any)[0].total}`);
  console.log(`With NULL country_code: ${(withNull as any)[0].total}`);
  
  const countryDist = await db.execute(sql`
    SELECT country_code, COUNT(*) as cnt
    FROM projects 
    WHERE country_code IS NOT NULL AND country_code != 'UNKNOWN'
    GROUP BY country_code
    ORDER BY cnt DESC
    LIMIT 20
  `);
  console.log('\nTop 20 Countries:');
  for (const row of countryDist as any[]) {
    console.log(`  ${row.country_code}: ${row.cnt} projects`);
  }
  
  const bySource = await db.execute(sql`
    SELECT source, 
      COUNT(*) as total,
      COUNT(CASE WHEN country_code IS NOT NULL AND country_code != 'UNKNOWN' THEN 1 END) as with_country,
      COUNT(CASE WHEN country_code IS NULL THEN 1 END) as null_country
    FROM projects 
    GROUP BY source
  `);
  console.log('\nCountry coverage by source:');
  for (const row of bySource as any[]) {
    console.log(`  ${row.source}: ${row.with_country}/${row.total} have country (${row.null_country} NULL)`);
  }

  console.log('\n=== TOPICS/TAGS COVERAGE ===');
  
  const withTopics = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects 
    WHERE topics IS NOT NULL AND jsonb_array_length(topics) > 0
  `);
  const noTopics = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects 
    WHERE topics IS NULL OR jsonb_array_length(topics) = 0
  `);
  console.log(`Projects with topics: ${(withTopics as any)[0].total}`);
  console.log(`Projects without topics: ${(noTopics as any)[0].total}`);
  
  const topTopics = await db.execute(sql`
    SELECT topic, COUNT(*) as cnt
    FROM projects, jsonb_array_elements_text(topics) as topic
    WHERE topics IS NOT NULL AND jsonb_array_length(topics) > 0
    GROUP BY topic
    ORDER BY cnt DESC
    LIMIT 30
  `);
  console.log('\nTop 30 Topics:');
  for (const row of topTopics as any[]) {
    console.log(`  ${row.topic}: ${row.cnt} projects`);
  }

  console.log('\n=== CATEGORIES COVERAGE ===');
  
  const withCats = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects 
    WHERE categories IS NOT NULL AND jsonb_array_length(categories) > 0
  `);
  const noCats = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects 
    WHERE categories IS NULL OR jsonb_array_length(categories) = 0
  `);
  console.log(`Projects with categories: ${(withCats as any)[0].total}`);
  console.log(`Projects without categories: ${(noCats as any)[0].total}`);
  
  const catDist = await db.execute(sql`
    SELECT cat, COUNT(*) as cnt
    FROM projects, jsonb_array_elements_text(categories) as cat
    WHERE categories IS NOT NULL AND jsonb_array_length(categories) > 0
    GROUP BY cat
    ORDER BY cnt DESC
    LIMIT 30
  `);
  console.log('\nCategory distribution:');
  for (const row of catDist as any[]) {
    console.log(`  ${row.cat}: ${row.cnt} projects`);
  }

  console.log('\n=== GITHUB USERS CACHE ===');
  const totalUsers = await db.execute(sql`SELECT COUNT(*) as total FROM github_users`);
  const usersWithCountry = await db.execute(sql`SELECT COUNT(*) as total FROM github_users WHERE country_code IS NOT NULL AND country_code != 'UNKNOWN'`);
  const usersUnknown = await db.execute(sql`SELECT COUNT(*) as total FROM github_users WHERE country_code = 'UNKNOWN'`);
  console.log(`Total cached users: ${(totalUsers as any)[0].total}`);
  console.log(`Users with country: ${(usersWithCountry as any)[0].total}`);
  console.log(`Users with UNKNOWN: ${(usersUnknown as any)[0].total}`);

  const withLocationNoCountry = await db.execute(sql`
    SELECT id, source_id, location, country_code, source 
    FROM projects 
    WHERE location IS NOT NULL AND location != '' 
      AND (country_code IS NULL OR country_code = 'UNKNOWN')
    LIMIT 10
  `);
  console.log('\nSample projects with location but no country_code:');
  for (const row of withLocationNoCountry as any[]) {
    console.log(`  ${row.source_id} (${row.source}): location="${row.location}", country=${row.country_code}`);
  }

  // HF projects never have country
  const hfWithCountry = await db.execute(sql`
    SELECT COUNT(*) as total FROM projects WHERE source = 'huggingface' AND country_code IS NOT NULL AND country_code != 'UNKNOWN'
  `);
  console.log(`\nHF projects with country: ${(hfWithCountry as any)[0].total}`);

  process.exit(0);
}

checkCoverage().catch(err => {
  console.error(err);
  process.exit(1);
});
