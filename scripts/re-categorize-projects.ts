import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { categorizeProject, ensureCategoriesLoaded } from '../src/lib/categorizer';
import { eq } from 'drizzle-orm';

async function main() {
  console.log('[Re-categorize] Starting re-categorization of all projects in DB...');
  
  try {
    // 1. Ensure categories are loaded
    await ensureCategoriesLoaded(true);

    // 2. Fetch all projects
    console.log('[Re-categorize] Fetching projects from database...');
    const allProjects = await db.select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
      topics: projects.topics,
      projectType: projects.projectType,
      categories: projects.categories
    }).from(projects);

    console.log(`[Re-categorize] Found ${allProjects.length} projects to process.`);

    let updatedCount = 0;

    for (let i = 0; i < allProjects.length; i++) {
      const proj = allProjects[i];
      const rawTopics = (proj.topics as string[]) || [];
      const projectType = (proj.projectType as 'repository' | 'model' | 'dataset') || 'repository';
      
      // Calculate new categories based on topics
      const newCategories = await categorizeProject(rawTopics, projectType);
      
      // Sort to do array comparison
      const oldCategories = ((proj.categories as string[]) || []).slice().sort();
      const sortedNew = newCategories.slice().sort();

      const hasChanged = JSON.stringify(oldCategories) !== JSON.stringify(sortedNew);

      if (hasChanged) {
        console.log(`  * Updating [${proj.fullName}]: [${oldCategories.join(', ')}] -> [${sortedNew.join(', ')}]`);
        
        await db.update(projects)
          .set({
            categories: sortedNew,
            updatedAt: new Date()
          })
          .where(eq(projects.id, proj.id));
          
        updatedCount++;
      }
    }

    console.log(`\n[Re-categorize] Finished! Updated ${updatedCount}/${allProjects.length} projects.`);
  } catch (error) {
    console.error('[Re-categorize] Error re-categorizing projects:', error);
  } finally {
    process.exit(0);
  }
}

main();
