import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';
import { runTrendCalculation } from '../src/workers/cron';

async function main() {
  console.log('Fetching projects that have snapshots...');
  const activeProjects = await db.execute(sql`
    SELECT id, source, stars, downloads
    FROM projects
    WHERE id IN (SELECT DISTINCT project_id FROM project_snapshots)
  `);
  console.log(`Found ${activeProjects.length} projects with snapshots.`);

  console.log('Generating mock historical snapshots...');
  
  // Clear existing snapshots first to avoid conflicts and start clean
  await db.execute(sql`DELETE FROM project_snapshots`);
  console.log('Cleared existing snapshots.');

  const snapshotsToInsert: any[] = [];
  
  for (const proj of activeProjects as any[]) {
    const isGithub = proj.source === 'github';
    // Current metrics
    const currentStars = Number(proj.stars || 0);
    const currentDownloads = Number(proj.downloads || 0);
    
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
    // 1. Today (2026-06-16)
    // 2. Yesterday (2026-06-15)
    // 3. 7 days ago (2026-06-09)
    // 4. 30 days ago (2026-05-17)
    
    // Today snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: currentStars,
      likes: isGithub ? 0 : currentStars,
      downloads: currentDownloads,
      snapshot_date: '2026-06-16'
    });
    
    // Yesterday snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - dailyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - dailyGrowth),
      downloads: Math.max(0, currentDownloads - dailyGrowth),
      snapshot_date: '2026-06-15'
    });
    
    // 7 days ago snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - weeklyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - weeklyGrowth),
      downloads: Math.max(0, currentDownloads - weeklyGrowth),
      snapshot_date: '2026-06-09'
    });
    
    // 30 days ago snapshot
    snapshotsToInsert.push({
      project_id: proj.id,
      stars: Math.max(0, currentStars - monthlyGrowth),
      likes: isGithub ? 0 : Math.max(0, currentStars - monthlyGrowth),
      downloads: Math.max(0, currentDownloads - monthlyGrowth),
      snapshot_date: '2026-05-17'
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
