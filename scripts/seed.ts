import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects, projectSnapshots, rankings } from '../src/lib/db/schema';
import { MOCK_PROJECTS } from '../src/lib/mock-data';
import crypto from 'crypto';

async function seed() {
  console.log('Seeding database with mock data...');

  try {
    for (const mock of MOCK_PROJECTS) {
      const projectId = crypto.randomUUID();
      
      // Insert Project
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
      });

      // Insert Ranking
      await db.insert(rankings).values({
        projectId,
        period: 'daily',
        rankingDate: new Date().toISOString().split('T')[0],
        rank: mock.rank,
        score: mock.starsGained * 1.5,
        starsGained: mock.starsGained,
        velocityScore: mock.velocityScore,
      });

      // Insert Snapshot
      await db.insert(projectSnapshots).values({
        projectId,
        stars: mock.stars,
        forks: mock.forks,
        downloads: mock.downloads,
        snapshotDate: new Date().toISOString().split('T')[0],
      });
    }
    console.log('Database seeded successfully!');
  } catch (error) {
    console.error('Error seeding database:', error);
  }
  
  process.exit(0);
}

seed();
