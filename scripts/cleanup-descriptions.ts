import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { eq, isNotNull } from 'drizzle-orm';

function cleanReadmeForDescription(readme: string): string {
  let clean = readme.trim();
  // Strip YAML frontmatter
  if (clean.startsWith('---')) {
    const secondIndex = clean.indexOf('---', 3);
    if (secondIndex !== -1) {
      clean = clean.substring(secondIndex + 3).trim();
    }
  }
  // Strip HTML tags
  clean = clean.replace(/<[^>]*>/g, '');
  // Strip markdown characters
  clean = clean.replace(/[#*`_>\[\]]/g, '');
  // Replace multiple spaces/newlines with a single space
  clean = clean.replace(/\s+/g, ' ');
  return clean.substring(0, 250).trim() + '...';
}

async function main() {
  console.log('[Cleanup] Fetching projects with readme...');
  const allProjects = await db.select({
    id: projects.id,
    name: projects.name,
    description: projects.description,
    readme: projects.readme,
  })
  .from(projects)
  .where(isNotNull(projects.readme));

  console.log(`[Cleanup] Found ${allProjects.length} projects.`);
  let updatedCount = 0;

  for (const p of allProjects) {
    const desc = p.description || '';
    // If the description starts with --- (YAML metadata) or has HuggingFace raw card metadata tags, clean it up!
    if (desc.startsWith('---') || desc.includes('libraryname:') || desc.includes('license:') || desc.includes('<a href=') || desc.trim() === '') {
      if (p.readme) {
        const newDesc = cleanReadmeForDescription(p.readme);
        console.log(`[Cleanup] Updating description for ${p.name}:`);
        console.log(`  OLD: ${desc.substring(0, 100)}...`);
        console.log(`  NEW: ${newDesc.substring(0, 100)}...`);
        
        await db.update(projects)
          .set({ description: newDesc })
          .where(eq(projects.id, p.id));
          
        updatedCount++;
      }
    }
  }

  console.log(`[Cleanup] Successfully cleaned up ${updatedCount} descriptions.`);
  process.exit(0);
}

main().catch(console.error);
