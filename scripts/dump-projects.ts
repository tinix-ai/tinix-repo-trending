import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

async function main() {
  console.log('[Dump] Connecting to database and querying projects...');
  
  try {
    const allProjects = await db.select().from(projects);
    console.log(`[Dump] Found ${allProjects.length} projects in the database.`);
    
    if (allProjects.length === 0) {
      console.log('[Dump] No projects to dump. Exiting.');
      process.exit(0);
    }

    // Ensure the data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      console.log(`[Dump] Creating directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    const jsonString = JSON.stringify(allProjects, null, 2);
    
    // Save raw JSON locally (ignored by git)
    const rawOutputPath = path.join(dataDir, 'projects-seed.json');
    fs.writeFileSync(rawOutputPath, jsonString, 'utf-8');
    console.log(`[Dump] Saved raw JSON to: ${rawOutputPath}`);

    // Compress JSON using gzip
    console.log('[Dump] Compressing database dump using gzip...');
    const compressedBuffer = zlib.gzipSync(Buffer.from(jsonString, 'utf-8'));
    
    const compressedOutputPath = path.join(dataDir, 'projects-seed.json.gz');
    fs.writeFileSync(compressedOutputPath, compressedBuffer);
    console.log(`[Dump] Successfully compressed and wrote projects to: ${compressedOutputPath} (${(compressedBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
    
  } catch (error) {
    console.error('[Dump] Error dumping projects:', error);
  } finally {
    process.exit(0);
  }
}

main();
