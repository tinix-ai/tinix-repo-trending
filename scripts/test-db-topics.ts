import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  console.log("Testing Dynamic DB Topic Retrieval...");
  try {
    const rawResult = await db.execute(sql`
      SELECT LOWER(key::text) as topic, COUNT(*) as count 
      FROM projects, jsonb_array_elements_text(topics) as key 
      WHERE source = 'github'
      GROUP BY topic 
      ORDER BY count DESC 
      LIMIT 100
    `) as unknown as { topic: string; count: number }[];

    console.log(`Retrieved ${rawResult.length} raw topics from database.`);

    const blacklist = new Set([
      // Languages
      'javascript', 'typescript', 'python', 'html', 'css', 'rust', 'go', 'golang', 'cpp',
      'c', 'csharp', 'java', 'swift', 'kotlin', 'php', 'ruby', 'objective-c', 'objc',
      'clojure', 'elixir', 'erlang', 'haskell', 'scala', 'perl', 'assembly',
      // Frameworks / Web
      'react', 'vue', 'nextjs', 'angular', 'nodejs', 'laravel', 'django', 'flask',
      // Platforms / OS
      'android', 'ios', 'macos', 'windows', 'linux',
      // Generic terms
      'open-source', 'opensource', 'hacktoberfest', 'awesome', 'git', 'github', 'dev'
    ]);

    const topics: string[] = [];
    console.log("\nTop 30 filtered topics:");
    for (const row of rawResult) {
      const topic = row.topic.replace(/"/g, '').trim();
      if (topic && !blacklist.has(topic) && topic.length > 2) {
        topics.push(topic);
        console.log(` - ${topic} (count: ${row.count})`);
        if (topics.length >= 30) break;
      }
    }
  } catch (error) {
    console.error("Error retrieving DB topics:", error);
  }
  process.exit(0);
}

main().catch(console.error);
