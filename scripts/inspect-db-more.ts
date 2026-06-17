import 'dotenv/config';
import { db } from '../src/lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const days = 1;
  const minStars = 100;
  const minDownloads = 1000;
  const limit = 20;
  const offset = 0;

  const starsGainedCol = days === 1 ? sql`t.daily_stars` : days === 7 ? sql`t.weekly_stars` : sql`t.monthly_stars`;
  const downloadsGainedCol = days === 1 ? sql`t.daily_downloads` : days === 7 ? sql`t.weekly_downloads` : sql`t.monthly_downloads`;

  const filters = [];
  filters.push(sql`momentum_score >= 0`);
  filters.push(sql`((source = 'github' AND stars >= ${minStars}) OR (source = 'huggingface' AND downloads >= ${minDownloads}) OR (source NOT IN ('github', 'huggingface')))`);
  
  const whereFragment = sql.join(filters, sql` AND `);

  const query = sql`
      WITH current_snapshots AS (
        SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, open_issues, likes, downloads, snapshot_date
        FROM project_snapshots
        ORDER BY project_id, snapshot_date DESC
      ),
      sparkline_history AS (
        SELECT 
          project_id,
          json_agg(
            COALESCE(stars, likes, 0) ORDER BY snapshot_date ASC
          ) as sparkline_data
        FROM project_snapshots
        WHERE snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
        GROUP BY project_id
      ),
      deltas AS (
        SELECT 
          p.id as project_id,
          p.source,
          p.project_type,
          p.source_id,
          p.slug,
          p.name,
          p.full_name,
          p.description,
          p.ai_summary,
          p.homepage_url,
          p.source_url,
          p.primary_language,
          p.license,
          p.owner_name,
          p.owner_avatar_url,
          p.owner_type,
          p.topics,
          p.created_at,
          p.updated_at,
          p.last_crawled_at,
          p.source_created_at,
          p.source_updated_at,
          p.categories,
          GREATEST(COALESCE(
            CASE 
              WHEN p.source = 'github' THEN ${starsGainedCol}
              ELSE 0
            END, 0
          ), 0) as stars_gained,
          0 as forks_gained,
          0 as contributors_gained,
          GREATEST(COALESCE(
            CASE 
              WHEN p.source = 'huggingface' THEN ${starsGainedCol}
              ELSE 0
            END, 0
          ), 0) as likes_gained,
          GREATEST(COALESCE(${downloadsGainedCol}, 0), 0) as downloads_gained,
          sh.sparkline_data,
          c.stars, c.forks, c.downloads, c.likes, c.open_issues, c.contributors_count as current_contributors_count
        FROM projects p
        JOIN current_snapshots c ON p.id = c.project_id
        LEFT JOIN project_trends t ON p.id = t.project_id
        LEFT JOIN sparkline_history sh ON p.id = sh.project_id
      ),
      scored AS (
        SELECT 
          *,
          CASE 
            WHEN source = 'github' THEN LN(stars_gained + 1) * 15.0
            WHEN source = 'huggingface' THEN LN(downloads_gained + 1) * 2.5
            ELSE 0 
          END as momentum_score
        FROM deltas
      ),
      filtered AS (
        SELECT * FROM scored
        WHERE ${whereFragment}
      )
      SELECT 
        *,
        COUNT(*) OVER() as total_count,
        ROW_NUMBER() OVER(ORDER BY momentum_score DESC) as rank
      FROM filtered
      ORDER BY rank ASC
      LIMIT ${limit} OFFSET ${offset};
  `;

  try {
    const results = await db.execute(query);
    console.log('Results length:', results.length);
    if (results.length > 0) {
      console.log('Sample result:', {
        id: results[0].project_id,
        name: results[0].name,
        source: results[0].source,
        stars: results[0].stars,
        stars_gained: results[0].stars_gained,
        downloads: results[0].downloads,
        downloads_gained: results[0].downloads_gained,
        momentum_score: results[0].momentum_score
      });
    }
  } catch (err) {
    console.error('Error executing test query:', err);
  }
  process.exit(0);
}

main();
