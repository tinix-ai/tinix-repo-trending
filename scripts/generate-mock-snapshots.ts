import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { runTrendCalculation } from '../src/workers/cron';

async function main() {
  console.log('Fetching all projects...');
  const activeProjects = await db.execute(sql`
    SELECT id, source
    FROM projects
  `);
  console.log(`Found ${activeProjects.length} projects.`);

  console.log('Generating mock historical snapshots...');
  
  // Clear existing snapshots first to avoid conflicts and start clean
  await db.execute(sql`DELETE FROM project_snapshots`);
  console.log('Cleared existing snapshots.');

  const snapshotsToInsert: {
    project_id: string;
    stars: number;
    likes: number;
    downloads: number;
    snapshot_date: string;
  }[] = [];
  
  const todayStr = new Date().toISOString().split('T')[0];
  const yesterdayStr = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const weekAgoStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const monthAgoStr = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  
  for (const proj of activeProjects as unknown as { id: string; source: string; stars?: number; downloads?: number; }[]) {
    const isGithub = proj.source === 'github';
    // Current metrics
    const currentStars = isGithub 
      ? Math.floor(Math.random() * 45000) + 500 
      : Math.floor(Math.random() * 4500) + 50;
    const currentDownloads = isGithub 
      ? 0 
      : Math.floor(Math.random() * 4995000) + 5000;
    
    // Generate growth values
    let dailyGrowth, weeklyGrowth, monthlyGrowth;
    if (isGithub) {
      dailyGrowth = Math.floor(Math.random() * 80) + 10; // 10 to 90 stars
      weeklyGrowth = dailyGrowth * 7 + Math.floor(Math.random() * 200) + 50;
      monthlyGrowth = weeklyGrowth * 4 + Math.floor(Math.random() * 1000) + 200;
    } else {
      dailyGrowth = Math.floor(Math.random() * 3000) + 500; // 500 to 3500 downloads
      weeklyGrowth = dailyGrowth * 7 + Math.floor(Math.random() * 10000) + 2000;
      monthlyGrowth = weeklyGrowth * 4 + Math.floor(Math.random() * 50000) + 10000;
    }
    
    // Snaps to create:
    // 1. Today
    // 2. Yesterday
    // 3. 7 days ago
    // 4. 30 days ago
    
    // Today snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: currentStars,
      likes: isGithub ? 0 : currentStars,
      downloads: currentDownloads,
      snapshot_date: todayStr
    });
    
    // Yesterday snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - dailyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - dailyGrowth),
      downloads: Math.max(0, currentDownloads - dailyGrowth),
      snapshot_date: yesterdayStr
    });
    
    // 7 days ago snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - weeklyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - weeklyGrowth),
      downloads: Math.max(0, currentDownloads - weeklyGrowth),
      snapshot_date: weekAgoStr
    });
    
    // 30 days ago snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - monthlyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - monthlyGrowth),
      downloads: Math.max(0, currentDownloads - monthlyGrowth),
      snapshot_date: monthAgoStr
    });
  }

  // Insert in chunks
  console.log(`Inserting ${snapshotsToInsert.length} mock snapshots...`);
  const CHUNK_SIZE = 1000;
  for (let i = 0; i < snapshotsToInsert.length; i += CHUNK_SIZE) {
    const chunk = snapshotsToInsert.slice(i, i + CHUNK_SIZE);
    
    // Construct bulk insert values
    const valuesSql = chunk.map(s => 
      sql`(${s.project_id}, ${s.stars}, ${s.likes}, ${s.downloads}, ${s.snapshot_date}::date)`
    );
    
    await db.execute(sql`
      INSERT INTO project_snapshots (project_id, stars, likes, downloads, snapshot_date)
      VALUES ${sql.join(valuesSql, sql`, `)}
    `);
    
    if ((i + CHUNK_SIZE) % 5000 === 0 || i + CHUNK_SIZE >= snapshotsToInsert.length) {
      console.log(`Progress: ${Math.min(i + CHUNK_SIZE, snapshotsToInsert.length)}/${snapshotsToInsert.length} inserted.`);
    }
  }

  console.log('Recalculating project trends...');
  await runTrendCalculation();
  console.log('Done generating mock snapshot data and recalculating trends!');
  process.exit(0);
}

main().catch(console.error);
