import 'dotenv/config';
import { db } from '../src/lib/db';
import { projects } from '../src/lib/db/schema';
import { sql, eq, and, isNull, isNotNull } from 'drizzle-orm';
import { parseCountryFromProfile } from '../src/lib/location-parser';

/**
 * Backfill country_code for projects that have a location string but no country_code.
 * Uses the expanded location-parser to re-parse.
 */
async function backfillCountryCodes() {
  console.log('[Backfill] Starting country_code backfill...');

  // Fetch projects with location but NULL country_code
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
      isNull(projects.countryCode)
    )
  );

  console.log(`[Backfill] Found ${rows.length} projects with location but no country_code.`);

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const parsedCode = parseCountryFromProfile({ location: row.location });
    
    if (parsedCode) {
      await db.update(projects)
        .set({ countryCode: parsedCode })
        .where(eq(projects.id, row.id));
      updated++;

      if (updated <= 20 || updated % 500 === 0) {
        console.log(`[Backfill] ${row.sourceId}: "${row.location}" → ${parsedCode} (${updated} updated)`);
      }
    } else {
      failed++;
      if (failed <= 10) {
        console.log(`[Backfill] MISS: ${row.sourceId}: "${row.location}" → no match`);
      }
    }
  }

  console.log(`[Backfill] Done! Updated: ${updated}, Still unmatched: ${failed}, Total processed: ${rows.length}`);
  process.exit(0);
}

backfillCountryCodes().catch(err => {
  console.error('[Backfill] Error:', err);
  process.exit(1);
});
