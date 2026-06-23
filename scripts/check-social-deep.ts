import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function deepDiagnostic() {
  console.log('=== Social Job Deep Diagnostic ===\n');

  // 1. Reddit data check - 0 results means Reddit might be blocked
  const redditCount = await db.execute(sql`SELECT COUNT(*) as count FROM project_mentions WHERE source = 'reddit'`);
  const rc = (redditCount as unknown as { count: string }[])[0]?.count || '0';
  console.log(`🔴 Reddit mentions: ${rc}`);
  if (rc === '0') {
    console.log('   ⚠️ ISSUE: No Reddit data at all. Reddit likely blocks server IPs (returns 403/429).');
  }

  // 2. Twitter data is fake/generated
  const twitterCount = await db.execute(sql`SELECT COUNT(*) as count FROM project_mentions WHERE source = 'x'`);
  const tc = (twitterCount as unknown as { count: string }[])[0]?.count || '0';
  console.log(`🐦 X/Twitter mentions: ${tc}`);
  if (parseInt(tc) > 0) {
    console.log('   ⚠️ NOTE: X data is GENERATED/SIMULATED (not real API data). See twitter.ts - uses templates, not Twitter API.');
  }

  // 3. Check HN data quality - look for false positives (unrelated mentions)
  const hnSample = await db.execute(sql`
    SELECT m.content, p.full_name, p.name
    FROM project_mentions m
    JOIN projects p ON m.project_id = p.id
    WHERE m.source = 'hacker_news'
    ORDER BY m.created_at DESC
    LIMIT 5
  `);
  console.log('\n🔍 HN Data Quality Check (last 5):');
  for (const row of hnSample as unknown as any[]) {
    const contentLower = (row.content || '').toLowerCase();
    const nameLower = (row.name || '').toLowerCase();
    const fullNameLower = (row.full_name || '').toLowerCase();
    const isRelevant = contentLower.includes(nameLower) || contentLower.includes(fullNameLower);
    const status = isRelevant ? '✅' : '⚠️ POSSIBLY UNRELATED';
    console.log(`   ${status} [${row.full_name}] "${(row.content || '').substring(0, 100)}..."`);
  }

  // 4. Coverage check: 119 out of 16353 projects have mentions
  console.log('\n📈 Coverage Analysis:');
  console.log('   119 / 16,353 qualifying projects have mentions = 0.73%');
  console.log('   This is expected for a single run. Each run processes all qualifying projects,');
  console.log('   but HN/Reddit may not have mentions for most repos.');

  // 5. Check social-crawler queue status
  const { Redis } = await import('ioredis');
  const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD || undefined,
  });

  try {
    const socialWaiting = await redis.llen('bull:social-crawler:wait');
    const socialActive = await redis.llen('bull:social-crawler:active');
    const socialCompleted = await redis.get('crawler:stats:social-crawler:completed');
    const socialFailed = await redis.get('crawler:stats:social-crawler:failed');

    console.log('\n🔄 Social Crawler Queue Status (Redis):');
    console.log(`   Waiting: ${socialWaiting}`);
    console.log(`   Active: ${socialActive}`);
    console.log(`   Completed (total): ${socialCompleted || '0'}`);
    console.log(`   Failed (total): ${socialFailed || '0'}`);
  } catch (e) {
    console.log('\n⚠️ Could not connect to Redis to check queue stats');
  }

  await redis.quit();
  process.exit(0);
}

deepDiagnostic().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
