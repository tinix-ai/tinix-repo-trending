import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function checkSocialData() {
  console.log('=== Social Mentions Data Check ===\n');

  // 1. Total mentions count
  const totalResult = await db.execute(sql`SELECT COUNT(*) as total FROM project_mentions`);
  const total = (totalResult as unknown as { total: string }[])[0]?.total || '0';
  console.log(`📊 Total mentions in DB: ${total}`);

  // 2. Breakdown by source
  const bySource = await db.execute(sql`
    SELECT source, COUNT(*) as count 
    FROM project_mentions 
    GROUP BY source 
    ORDER BY count DESC
  `);
  console.log('\n📋 Mentions by source:');
  for (const row of bySource as unknown as { source: string; count: string }[]) {
    console.log(`   ${row.source}: ${row.count}`);
  }

  // 3. Recent 10 mentions
  const recent = await db.execute(sql`
    SELECT m.source, m.author, LEFT(m.content, 80) as content_preview, 
           m.url, m.score, m.comments_count, m.mentioned_at,
           p.full_name as project_name
    FROM project_mentions m
    JOIN projects p ON m.project_id = p.id
    ORDER BY m.created_at DESC
    LIMIT 10
  `);
  console.log('\n🕐 Last 10 mentions:');
  for (const row of recent as unknown as any[]) {
    console.log(`   [${row.source}] ${row.project_name} - by ${row.author} (score: ${row.score}) - ${row.content_preview}...`);
  }

  // 4. How many unique projects have mentions
  const uniqueProjects = await db.execute(sql`
    SELECT COUNT(DISTINCT project_id) as count FROM project_mentions
  `);
  const projectCount = (uniqueProjects as unknown as { count: string }[])[0]?.count || '0';
  console.log(`\n🔗 Unique projects with mentions: ${projectCount}`);

  // 5. Check social-crawler queue stats in Redis (if possible)
  // 6. Check how many projects qualify for social crawling (stars >= 100)
  const qualifyingProjects = await db.execute(sql`
    WITH latest_snapshots AS (
      SELECT DISTINCT ON (project_id) project_id, stars, likes
      FROM project_snapshots
      ORDER BY project_id, snapshot_date DESC
    )
    SELECT COUNT(*) as count
    FROM projects p
    JOIN latest_snapshots s ON p.id = s.project_id
    WHERE (p.source = 'github' AND COALESCE(s.stars, 0) >= 100)
       OR (p.source = 'huggingface' AND COALESCE(s.likes, 0) >= 100)
  `);
  const qualifyCount = (qualifyingProjects as unknown as { count: string }[])[0]?.count || '0';
  console.log(`\n⭐ Projects qualifying for social crawl (>= 100 stars/likes): ${qualifyCount}`);

  // 7. Check for potential issues - duplicate URLs
  const duplicates = await db.execute(sql`
    SELECT url, COUNT(*) as count 
    FROM project_mentions 
    GROUP BY url 
    HAVING COUNT(*) > 1
    LIMIT 5
  `);
  if ((duplicates as unknown as any[]).length > 0) {
    console.log('\n⚠️ Duplicate mention URLs found:');
    for (const row of duplicates as unknown as { url: string; count: string }[]) {
      console.log(`   ${row.url} (${row.count} times)`);
    }
  } else {
    console.log('\n✅ No duplicate URLs found');
  }

  process.exit(0);
}

checkSocialData().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
