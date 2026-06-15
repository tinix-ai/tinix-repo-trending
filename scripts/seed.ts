import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { MOCK_PROJECTS } from '../src/lib/mock-data';
import crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

async function seed() {
  const seedGzPath = path.join(process.cwd(), 'data', 'projects-seed.json.gz');

  if (fs.existsSync(seedGzPath)) {
    console.log(`[Seed] Found compressed seed data: ${seedGzPath}`);
    console.log('[Seed] Decompressing and parsing projects list...');
    
    try {
      const startTime = Date.now();
      const compressedBuffer = fs.readFileSync(seedGzPath);
      const decompressedString = zlib.gunzipSync(compressedBuffer).toString('utf-8');
      const parsedProjects = JSON.parse(decompressedString);
      
      console.log(`[Seed] Successfully loaded ${parsedProjects.length} projects from compressed seed.`);

      // Check if database already has projects
      const existingProjectsCount = await db.select({ count: projects.id }).from(projects).limit(1);
      if (existingProjectsCount.length > 0) {
        console.log('[Seed] Database is not empty. Inserting missing projects (onConflictDoNothing)...');
      } else {
        console.log('[Seed] Database is empty. Seeding real projects data...');
      }

      // Format fields to match DB schema types (date strings to Date objects)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const formattedProjects = parsedProjects.map((p: any) => ({
        ...p,
        createdAt: p.createdAt ? new Date(p.createdAt) : new Date(),
        updatedAt: p.updatedAt ? new Date(p.updatedAt) : new Date(),
        sourceCreatedAt: p.sourceCreatedAt ? new Date(p.sourceCreatedAt) : null,
        sourceUpdatedAt: p.sourceUpdatedAt ? new Date(p.sourceUpdatedAt) : null,
        lastCrawledAt: p.lastCrawledAt ? new Date(p.lastCrawledAt) : null,
        nextCrawlAt: p.nextCrawlAt ? new Date(p.nextCrawlAt) : null,
      }));

      // Insert in chunks of 500 to avoid parameter limit in query builder
      const CHUNK_SIZE = 500;
      let insertedCount = 0;
      
      for (let i = 0; i < formattedProjects.length; i += CHUNK_SIZE) {
        const chunk = formattedProjects.slice(i, i + CHUNK_SIZE);
        await db.insert(projects).values(chunk).onConflictDoNothing();
        insertedCount += chunk.length;
        if (insertedCount % 2500 === 0 || insertedCount === formattedProjects.length) {
          console.log(`[Seed] Seeding progress: ${insertedCount}/${formattedProjects.length} projects...`);
        }
      }

      const duration = ((Date.now() - startTime) / 1000).toFixed(2);
      console.log(`[Seed] Database seeded successfully in ${duration} seconds!`);

    } catch (error) {
      console.error('[Seed] Failed to seed from compressed data:', error);
    }
    
    process.exit(0);
  }

  // Fallback to mock projects if projects-seed.json.gz doesn't exist
  console.log('[Seed] Compressed seed file not found. Seeding database with mock data...');
  try {
    for (const mock of MOCK_PROJECTS) {
      const projectId = crypto.randomUUID();
      
      await db.insert(projects).values({
        id: projectId,
        source: mock.source,
        sourceId: `${mock.ownerName}/${mock.slug}`,
        slug: mock.slug,
        name: mock.fullName.split('/')[1] || mock.fullName,
        fullName: mock.fullName,
        description: mock.description,
        sourceUrl: mock.sourceUrl,
        primaryLanguage: mock.primaryLanguage,
        ownerName: mock.ownerName,
        createdAt: new Date(),
        updatedAt: new Date(),
        sourceCreatedAt: new Date(mock.sourceCreatedAt),
      }).onConflictDoNothing();
    }
    console.log('[Seed] Database seeded with mock data successfully!');
  } catch (error) {
    console.error('[Seed] Error seeding database with mock data:', error);
  }
  
  process.exit(0);
}

seed();
