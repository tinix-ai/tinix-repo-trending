import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { sql, eq, and, isNotNull } from 'drizzle-orm';
import { parseCountryFromProfile } from '../src/lib/location-parser';

/**
 * Re-verify and fix all projects that have a location AND country_code.
 * Uses the updated (fixed) location parser to correct false positives.
 */
async function fixFalsePositives() {
  console.log('[Fix] Starting false positive correction...');

  // Get all projects with both location and country_code set
  const rows = await db.select({
    id: projects.id,
    sourceId: projects.sourceId,
    location: projects.location,
    countryCode: projects.countryCode,
  })
  .from(projects)
  .where(
    and(
      isNotNull(projects.location),
      sql`${projects.location} != ''`,
      isNotNull(projects.countryCode),
      sql`${projects.countryCode} != 'UNKNOWN'`
    )
  );

  console.log(`[Fix] Checking ${rows.length} projects with existing country_code...`);

  let corrected = 0;
  let cleared = 0;
  let unchanged = 0;

  for (const row of rows) {
    const newCode = parseCountryFromProfile({ location: row.location });
    
    if (newCode !== row.countryCode) {
      if (newCode) {
        // Country code changed
        await db.update(projects)
          .set({ countryCode: newCode })
          .where(eq(projects.id, row.id));
        corrected++;
        if (corrected <= 30) {
          console.log(`[Fix] CORRECTED: ${row.sourceId}: "${row.location}" ${row.countryCode} → ${newCode}`);
        }
      } else {
        // Parser no longer returns a match → clear the false positive
        await db.update(projects)
          .set({ countryCode: null })
          .where(eq(projects.id, row.id));
        cleared++;
        if (cleared <= 30) {
          console.log(`[Fix] CLEARED: ${row.sourceId}: "${row.location}" was ${row.countryCode} → NULL`);
        }
      }
    } else {
      unchanged++;
    }
  }

  console.log(`\n[Fix] Done! Corrected: ${corrected}, Cleared (false positives): ${cleared}, Unchanged: ${unchanged}, Total: ${rows.length}`);
  process.exit(0);
}

fixFalsePositives().catch(err => {
  console.error('[Fix] Error:', err);
  process.exit(1);
});
