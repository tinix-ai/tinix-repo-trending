import { db } from './index';
import { sql } from 'drizzle-orm';
import type { RankedProject, ProjectMention, RecentProjectMention, ProjectSource } from '@/types';
import { CATEGORY_METADATA, ensureCategoriesLoaded } from '../categorizer';
import * as zlib from 'zlib';

function decompressReadme(value: unknown): string | null {
  if (!value) return null;
  if (Buffer.isBuffer(value)) {
    try {
      if (value.length >= 2 && value[0] === 0x1f && value[1] === 0x8b) {
        return zlib.gunzipSync(value).toString('utf-8');
      }
      return value.toString('utf-8');
    } catch (err) {
      console.error('[Queries] Failed to decompress readme buffer:', err);
      return value.toString('utf-8');
    }
  }
  if (typeof value === 'string') {
    return value;
  }
  return null;
}


export interface ProjectQueryParams {
  days?: number;
  minStars?: number;
  minDownloads?: number;
  category?: string;
  source?: string;
  language?: string;
  searchQuery?: string;
  tag?: string;
  limit?: number;
  offset?: number;
  filterType?: "trending" | "all" | "new";
  sortBy?: "project" | "stars" | "trend" | "updated";
  sortOrder?: "asc" | "desc";
}

export async function getDynamicTrendingProjects(params: ProjectQueryParams): Promise<{ projects: RankedProject[], total: number }> {
  await ensureCategoriesLoaded();
  const days = params.days ?? 7;
  const minStars = params.minStars ?? 100;
  const minDownloads = params.minDownloads ?? 1000;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const filterType = params.filterType ?? "trending";

  const filters = [];

  if (filterType === "trending") {
    // Exclude projects with zero growth
    filters.push(sql`momentum_score > 0`);

    // Apply dynamic noise filtering based on the time window
    if (days === 7) {
      filters.push(sql`((source = 'github' AND stars_gained >= 2) OR (source = 'huggingface' AND downloads_gained >= 20) OR (source NOT IN ('github', 'huggingface')))`);
    } else if (days >= 30) {
      filters.push(sql`((source = 'github' AND stars_gained >= 5) OR (source = 'huggingface' AND downloads_gained >= 50) OR (source NOT IN ('github', 'huggingface')))`);
    }

    filters.push(sql`((source = 'github' AND stars >= ${minStars}) OR (source = 'huggingface' AND downloads >= ${minDownloads}) OR (source NOT IN ('github', 'huggingface')))`);
    // Exclude newly discovered projects (less than 24 hours in the system) from trending
    // to ensure they have at least one overnight snapshot for accurate momentum calculation.
    filters.push(sql`created_at <= NOW() - INTERVAL '24 hours'`);
  }

  if (params.category) {
    filters.push(sql`categories @> ${JSON.stringify([params.category])}::jsonb`);
  }

  if (params.source) {
    filters.push(sql`source = ${params.source}`);
  }

  if (params.language) {
    filters.push(sql`primary_language = ${params.language}`);
  }

  if (params.searchQuery) {
    const search = `%${params.searchQuery}%`;
    filters.push(sql`(name ILIKE ${search} OR description ILIKE ${search} OR owner_name ILIKE ${search})`);
  }

  if (params.tag) {
    filters.push(sql`topics @> ${JSON.stringify([params.tag])}::jsonb`);
  }

  const whereFragment = filters.length > 0 ? sql.join(filters, sql` AND `) : sql`1=1`;

  let orderFragment = sql`ORDER BY momentum_score DESC`;
  
  if (params.sortBy) {
    const isAsc = params.sortOrder === "asc";
    switch (params.sortBy) {
      case "project":
        orderFragment = isAsc ? sql`ORDER BY full_name ASC` : sql`ORDER BY full_name DESC`;
        break;
      case "stars":
        orderFragment = isAsc ? sql`ORDER BY COALESCE(stars, likes, 0) ASC NULLS FIRST` : sql`ORDER BY COALESCE(stars, likes, 0) DESC NULLS LAST`;
        break;
      case "trend":
        orderFragment = isAsc ? sql`ORDER BY momentum_score ASC` : sql`ORDER BY momentum_score DESC`;
        break;
      case "updated":
        orderFragment = isAsc ? sql`ORDER BY last_crawled_at ASC NULLS FIRST` : sql`ORDER BY last_crawled_at DESC NULLS LAST`;
        break;
    }
  } else {
    orderFragment = filterType === "new"
      ? sql`ORDER BY source_created_at DESC NULLS LAST`
      : filterType === "all"
      ? sql`ORDER BY (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) * 5.0 + (COALESCE(downloads, 0) / 1000.0) END) DESC NULLS LAST`
      : sql`ORDER BY momentum_score DESC`;
  }

  let result;
  if (days === 1 || days === 7 || days === 30) {
    const starsGainedCol = days === 1 ? sql`t.daily_stars` : days === 7 ? sql`t.weekly_stars` : sql`t.monthly_stars`;
    const downloadsGainedCol = days === 1 ? sql`t.daily_downloads` : days === 7 ? sql`t.weekly_downloads` : sql`t.monthly_downloads`;

    result = await db.execute(sql`
      WITH deltas AS (
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
          p.stars, p.forks, p.downloads, p.likes, p.open_issues, p.contributors_count as current_contributors_count
        FROM projects p
        LEFT JOIN project_trends t ON p.id = t.project_id
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
      ),
      paginated AS (
        SELECT 
          *,
          COUNT(*) OVER() as total_count,
          ROW_NUMBER() OVER(${orderFragment}) as rank
        FROM filtered
        ORDER BY rank ASC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT 
        pg.*,
        (
          SELECT json_agg(COALESCE(stars, likes, 0) ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
            ORDER BY snapshot_date ASC
          ) s
        ) as sparkline_data,
        (SELECT COUNT(*) FROM project_mentions pm WHERE pm.project_id = pg.project_id) as mentions_count
      FROM paginated pg
      ORDER BY pg.rank ASC;
    `);
  } else {
    result = await db.execute(sql`
      WITH previous_snapshots AS (
        SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, open_issues, likes, downloads, snapshot_date
        FROM project_snapshots
        WHERE snapshot_date <= CURRENT_DATE - ${days} * INTERVAL '1 day'
        ORDER BY project_id, snapshot_date DESC
      ),
      earliest_snapshots AS (
        SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, open_issues, likes, downloads, snapshot_date
        FROM project_snapshots
        ORDER BY project_id, snapshot_date ASC
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
          GREATEST(p.stars - COALESCE(prev.stars, earliest.stars, p.stars), 0) as stars_gained,
          GREATEST(p.forks - COALESCE(prev.forks, earliest.forks, p.forks), 0) as forks_gained,
          GREATEST(p.contributors_count - COALESCE(prev.contributors_count, earliest.contributors_count, p.contributors_count), 0) as contributors_gained,
          GREATEST(p.likes - COALESCE(prev.likes, earliest.likes, p.likes), 0) as likes_gained,
          GREATEST(p.downloads - COALESCE(prev.downloads, earliest.downloads, p.downloads), 0) as downloads_gained,
          p.stars, p.forks, p.downloads, p.likes, p.open_issues, p.contributors_count as current_contributors_count
        FROM projects p
        LEFT JOIN previous_snapshots prev ON p.id = prev.project_id
        LEFT JOIN earliest_snapshots earliest ON p.id = earliest.project_id
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
      ),
      paginated AS (
        SELECT 
          *,
          COUNT(*) OVER() as total_count,
          ROW_NUMBER() OVER(${orderFragment}) as rank
        FROM filtered
        ORDER BY rank ASC
        LIMIT ${limit} OFFSET ${offset}
      )
      SELECT 
        pg.*,
        (
          SELECT json_agg(COALESCE(stars, likes, 0) ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
            ORDER BY snapshot_date ASC
          ) s
        ) as sparkline_data,
        (SELECT COUNT(*) FROM project_mentions pm WHERE pm.project_id = pg.project_id) as mentions_count
      FROM paginated pg
      ORDER BY pg.rank ASC;
    `);
  }

  const total = result.length > 0 ? Number((result[0] as Record<string, unknown>).total_count || 0) : 0;

  const projects = result.map(row => {
    const r = row as Record<string, unknown>;
    return {
      id: r.project_id as string,
      source: r.source as "github" | "huggingface" | "paperwithcode",
      projectType: (r.project_type || 'repository') as "repository" | "model" | "dataset",
      sourceId: r.source_id as string,
      slug: r.slug as string,
      name: r.name as string,
      fullName: r.full_name as string,
      description: (r.description as string) || '',
      aiSummary: (r.ai_summary as string) || undefined,
      homepageUrl: (r.homepage_url as string) || undefined,
      sourceUrl: r.source_url as string,
      primaryLanguage: (r.primary_language as string) || undefined,
      license: (r.license as string) || undefined,
      ownerName: r.owner_name as string,
      ownerAvatarUrl: (r.owner_avatar_url as string) || '',
      ownerType: ((r.owner_type as string) || 'user') as "user" | "org",
      topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
      createdAt: typeof r.created_at === 'string' ? r.created_at : ((r.created_at as Date)?.toISOString() || new Date().toISOString()),
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : ((r.updated_at as Date)?.toISOString() || new Date().toISOString()),
      sourceCreatedAt: typeof r.source_created_at === 'string' ? r.source_created_at : ((r.source_created_at as Date)?.toISOString() || new Date().toISOString()),
      sourceUpdatedAt: r.source_updated_at ? (typeof r.source_updated_at === 'string' ? r.source_updated_at : (r.source_updated_at as Date).toISOString()) : undefined,
      lastCrawledAt: typeof r.last_crawled_at === 'string' ? r.last_crawled_at : ((r.last_crawled_at as Date)?.toISOString() || new Date().toISOString()),
      
      rank: Number(r.rank),
      score: Number(r.momentum_score),
      starsGained: Number(r.source === 'github' ? r.stars_gained : r.likes_gained),
      forksGained: Number(r.source === 'github' ? r.forks_gained : 0),
      downloadsGained: Number(r.downloads_gained || 0),
      mentionsCount: Number(r.mentions_count || 0),
      velocityScore: Number(r.momentum_score),
      momentumScore: Number(r.momentum_score),
      
      stars: Number(r.source === 'github' ? r.stars : r.likes),
      forks: Number(r.forks || 0),
      openIssues: Number(r.open_issues || 0),
      downloads: Number(r.downloads || 0),
      watchers: 0,
      contributorsCount: Number(r.current_contributors_count || 0),
      tags: [],
      categories: (Array.isArray(r.categories) ? (r.categories as string[]) : []).map((catName: string, i: number) => {
        const meta = CATEGORY_METADATA[catName] || { icon: "🏷️", color: "#6b7280" };
        return {
          id: `cat-${r.project_id}-${i}`,
          name: catName,
          slug: catName.toLowerCase().replace(/\s+/g, '-'),
          icon: meta.icon,
          color: meta.color,
          sortOrder: i,
        };
      }),
      sparklineData: Array.isArray(r.sparkline_data) ? (r.sparkline_data as number[]) : Array.from({ length: 14 }, () => Math.floor(Math.random() * 50) + 10),
    };
  });

  return { projects, total };
}

export async function getGlobalStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM projects) as total_projects,
        (
          SELECT COUNT(*) 
          FROM projects p
          WHERE 
            (p.source = 'github' AND p.stars >= 100) OR
            (p.source = 'huggingface' AND p.downloads >= 1000) OR
            (p.source NOT IN ('github', 'huggingface'))
        ) as trending_projects,
        (SELECT COUNT(*) FROM projects WHERE source_created_at >= CURRENT_DATE - INTERVAL '30 days') as new_projects
    `);
    return {
      totalProjects: Number(result[0]?.total_projects || 0),
      trendingProjects: Number(result[0]?.trending_projects || 0),
      newProjects: Number(result[0]?.new_projects || 0)
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { totalProjects: 0, trendingProjects: 0, newProjects: 0 };
  }
}

export async function getCategoryStats() {
  await ensureCategoriesLoaded();
  try {
    const result = await db.execute(sql`
      SELECT 
        category as name,
        COUNT(*) as count
      FROM projects,
      jsonb_array_elements_text(categories) as category
      GROUP BY category
      ORDER BY count DESC
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      const rName = r.name as string;
      const meta = CATEGORY_METADATA[rName] || { icon: "🏷️", color: "#6b7280" };
      return {
        id: rName.toLowerCase().replace(/\s+/g, '-'),
        name: rName,
        slug: rName.toLowerCase().replace(/\s+/g, '-'),
        icon: meta.icon,
        color: meta.color,
        projectCount: Number(r.count),
      };
    });
  } catch (error) {
    console.error("Error fetching category stats:", error);
    return [];
  }
}

export async function getPopularLanguagesAndHashtags() {
  try {
    const langs = await db.execute(sql`
      SELECT primary_language as name, COUNT(*) as count
      FROM projects
      WHERE source = 'github' AND primary_language IS NOT NULL AND primary_language != ''
      GROUP BY primary_language
      ORDER BY count DESC
      LIMIT 20;
    `);

    const tags = await db.execute(sql`
      SELECT t.topic as name, COUNT(*) as count
      FROM projects p,
      LATERAL jsonb_array_elements_text(p.topics) t(topic)
      WHERE p.topics IS NOT NULL 
        AND jsonb_typeof(p.topics) = 'array'
        AND t.topic NOT LIKE '%:%'
        AND LENGTH(t.topic) > 2
        AND t.topic NOT IN ('en', 'zh', 'fr', 'ja', 'ko', 'es', 'de', 'pt', 'it', 'ru')
      GROUP BY t.topic
      ORDER BY count DESC
      LIMIT 10;
    `);

    return {
      languages: langs.map(r => String(r.name)),
      hashtags: tags.map(r => String(r.name))
    };
  } catch (error) {
    console.error("Error fetching popular languages/hashtags:", error);
    return { languages: [], hashtags: [] };
  }
}


export async function getProjectById(id: string) {
  try {
    const result = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(p.stars, 0) as current_stars,
        COALESCE(p.forks, 0) as current_forks,
        COALESCE(p.open_issues, 0) as current_issues,
        COALESCE(p.downloads, 0) as current_downloads,
        COALESCE(p.likes, 0) as current_likes
      FROM projects p
      WHERE p.id = ${id}
      LIMIT 1
    `);
    
    if (result.length === 0) {
      return null;
    }

    const r = result[0] as Record<string, unknown>;
    return {
      id: r.id as string,
      source: r.source as "github" | "huggingface" | "paperwithcode",
      projectType: (r.project_type || 'repository') as "repository" | "model" | "dataset",
      sourceId: r.source_id as string,
      slug: r.slug as string,
      name: r.name as string,
      fullName: r.full_name as string,
      description: r.description as string,
      readme: decompressReadme(r.readme),
      aiSummary: r.ai_summary as string,
      homepageUrl: r.homepage_url as string,
      sourceUrl: r.source_url as string,
      primaryLanguage: r.primary_language as string,
      license: r.license as string,
      ownerName: r.owner_name as string,
      ownerAvatarUrl: r.owner_avatar_url as string,
      topics: (r.topics as string[]) || [],
      categories: (r.categories as string[]) || [],
      createdAt: typeof r.created_at === 'string' ? r.created_at : ((r.created_at as Date)?.toISOString() || new Date().toISOString()),
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : ((r.updated_at as Date)?.toISOString() || new Date().toISOString()),
      sourceCreatedAt: typeof r.source_created_at === 'string' ? r.source_created_at : ((r.source_created_at as Date)?.toISOString() || new Date().toISOString()),
      lastCrawledAt: typeof r.last_crawled_at === 'string' ? r.last_crawled_at : ((r.last_crawled_at as Date)?.toISOString() || new Date().toISOString()),
      // Metrics
      stars: r.source === 'huggingface' ? Number(r.current_likes) : Number(r.current_stars),
      forks: Number(r.current_forks),
      openIssues: Number(r.current_issues),
      downloads: Number(r.current_downloads),
    };
  } catch (error) {
    console.error("Error fetching project by ID:", error);
    return null;
  }
}

export async function getProjectBySlug(slug: string) {
  try {
    const result = await db.execute(sql`
      SELECT 
        p.*,
        COALESCE(p.stars, 0) as current_stars,
        COALESCE(p.forks, 0) as current_forks,
        COALESCE(p.open_issues, 0) as current_issues,
        COALESCE(p.downloads, 0) as current_downloads,
        COALESCE(p.likes, 0) as current_likes
      FROM projects p
      WHERE p.slug = ${slug}
      LIMIT 1
    `);

    if (result.length === 0) {
      return null;
    }

    const r = result[0] as Record<string, unknown>;
    return {
      id: r.id as string,
      source: r.source as "github" | "huggingface" | "paperwithcode",
      projectType: (r.project_type || 'repository') as "repository" | "model" | "dataset",
      sourceId: r.source_id as string,
      slug: r.slug as string,
      name: r.name as string,
      fullName: r.full_name as string,
      description: r.description as string,
      readme: decompressReadme(r.readme),
      aiSummary: r.ai_summary as string,
      homepageUrl: r.homepage_url as string,
      sourceUrl: r.source_url as string,
      primaryLanguage: r.primary_language as string,
      license: r.license as string,
      ownerName: r.owner_name as string,
      ownerAvatarUrl: r.owner_avatar_url as string,
      topics: (r.topics as string[]) || [],
      categories: (r.categories as string[]) || [],
      createdAt: typeof r.created_at === 'string' ? r.created_at : ((r.created_at as Date)?.toISOString() || new Date().toISOString()),
      updatedAt: typeof r.updated_at === 'string' ? r.updated_at : ((r.updated_at as Date)?.toISOString() || new Date().toISOString()),
      sourceCreatedAt: typeof r.source_created_at === 'string' ? r.source_created_at : ((r.source_created_at as Date)?.toISOString() || new Date().toISOString()),
      lastCrawledAt: typeof r.last_crawled_at === 'string' ? r.last_crawled_at : ((r.last_crawled_at as Date)?.toISOString() || new Date().toISOString()),
      // Metrics
      stars: r.source === 'huggingface' ? Number(r.current_likes) : Number(r.current_stars),
      forks: Number(r.current_forks),
      openIssues: Number(r.current_issues),
      downloads: Number(r.current_downloads),
    };
  } catch (error) {
    console.error("Error fetching project by slug:", error);
    return null;
  }
}

export async function getProjectHistory(projectId: string, days: number = 30) {
  try {
    const result = await db.execute(sql`
      SELECT DISTINCT ON (snapshot_date) 
        snapshot_date,
        stars,
        forks,
        downloads,
        likes
      FROM project_snapshots
      WHERE project_id = ${projectId}
        AND snapshot_date >= CURRENT_DATE - ${days} * INTERVAL '1 day'
      ORDER BY snapshot_date ASC, created_at DESC
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        date: new Date(r.snapshot_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        stars: Number(r.stars),
        forks: Number(r.forks),
        downloads: Number(r.downloads),
        likes: Number(r.likes)
      };
    });
  } catch (error) {
    console.error("Error fetching project history:", error);
    return [];
  }
}

export async function getDatabaseStorageStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        COUNT(*) as total_projects,
        SUM(CASE WHEN readme IS NOT NULL THEN 1 ELSE 0 END) as projects_with_readme,
        COALESCE(SUM(octet_length(readme)), 0) as compressed_readme_size,
        pg_database_size(current_database()) as db_size
      FROM projects;
    `);
    
    const stats = result[0] as unknown as {
      total_projects: string;
      projects_with_readme: string;
      compressed_readme_size: string;
      db_size: string;
    };
    
    const compressedBytes = Number(stats.compressed_readme_size || 0);
    // Average compression ratio for raw markdown in gzip is ~70-73% (meaning compressed is ~27-30% of original size)
    // So original size is roughly compressed size / 0.3
    const estimatedRawBytes = Math.round(compressedBytes / 0.3);
    const savedBytes = estimatedRawBytes - compressedBytes;

    return {
      totalProjects: Number(stats.total_projects || 0),
      projectsWithReadme: Number(stats.projects_with_readme || 0),
      compressedSize: compressedBytes,
      estimatedRawSize: estimatedRawBytes,
      savedSize: savedBytes,
      postgresDbSize: Number(stats.db_size || 0),
    };
  } catch (error) {
    console.error("Error fetching database storage stats:", error);
    return {
      totalProjects: 0,
      projectsWithReadme: 0,
      compressedSize: 0,
      estimatedRawSize: 0,
      savedSize: 0,
      postgresDbSize: 0,
    };
  }
}

export async function getDataStalenessStats() {
  try {
    const result = await db.execute(sql`
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE last_crawled_at >= NOW() - INTERVAL '24 hours') as fresh_24h,
        COUNT(*) FILTER (WHERE last_crawled_at < NOW() - INTERVAL '24 hours' AND last_crawled_at >= NOW() - INTERVAL '48 hours') as stale_24h,
        COUNT(*) FILTER (WHERE last_crawled_at < NOW() - INTERVAL '48 hours' OR last_crawled_at IS NULL) as stale_48h
      FROM projects;
    `);

    const r = result[0] as unknown as {
      total: string;
      fresh_24h: string;
      stale_24h: string;
      stale_48h: string;
    };

    const total = Number(r.total || 0);
    const fresh24h = Number(r.fresh_24h || 0);
    const stale24h = Number(r.stale_24h || 0);
    const stale48h = Number(r.stale_48h || 0);

    return {
      total,
      fresh24h,
      stale24h,
      stale48h,
      freshPercent: total > 0 ? Math.round((fresh24h / total) * 100) : 0,
      stale24hPercent: total > 0 ? Math.round((stale24h / total) * 100) : 0,
      stale48hPercent: total > 0 ? Math.round((stale48h / total) * 100) : 0,
    };
  } catch (error) {
    console.error("Error fetching data staleness stats:", error);
    return {
      total: 0,
      fresh24h: 0,
      stale24h: 0,
      stale48h: 0,
      freshPercent: 0,
      stale24hPercent: 0,
      stale48hPercent: 0,
    };
  }
}


export async function getLanguageStats() {
  try {
    const result = await db.execute(sql`
      SELECT primary_language as name, COUNT(*) as count
      FROM projects
      WHERE primary_language IS NOT NULL AND primary_language != ''
      GROUP BY primary_language
      ORDER BY count DESC
      LIMIT 10;
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        name: String(r.name),
        count: Number(r.count)
      };
    });
  } catch (error) {
    console.error("Error fetching language stats:", error);
    return [];
  }
}

export async function getDatabaseGrowthStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM projects WHERE created_at < CURRENT_DATE - INTERVAL '6 days') as base_count,
        TO_CHAR(d.day, 'YYYY-MM-DD') as date,
        COALESCE(p.count, 0) as new_count
      FROM (
        SELECT generate_series(
          CURRENT_DATE - INTERVAL '6 days',
          CURRENT_DATE,
          '1 day'::interval
        )::date as day
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM projects
        WHERE created_at >= CURRENT_DATE - INTERVAL '6 days'
        GROUP BY DATE(created_at)
      ) p ON d.day = p.day
      ORDER BY d.day ASC;
    `);
    
    let cumulative = 0;
    if (result.length > 0) {
      cumulative = Number((result[0] as Record<string, unknown>).base_count || 0);
    }
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      cumulative += Number(r.new_count || 0);
      return {
        date: new Date(r.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        count: cumulative
      };
    });
  } catch (error) {
    console.error("Error fetching database growth stats:", error);
    return [];
  }
}

export async function getProjectMentions(projectId: string): Promise<ProjectMention[]> {
  try {
    const result = await db.execute(sql`
      SELECT id, project_id as "projectId", source, author, author_avatar_url as "authorAvatarUrl", 
             content, url, score, comments_count as "commentsCount", mentioned_at as "mentionedAt", created_at as "createdAt"
      FROM project_mentions
      WHERE project_id = ${projectId}::uuid
      ORDER BY mentioned_at DESC;
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        projectId: String(r.projectId),
        source: String(r.source),
        author: String(r.author),
        authorAvatarUrl: r.authorAvatarUrl ? String(r.authorAvatarUrl) : undefined,
        content: String(r.content),
        url: String(r.url),
        score: Number(r.score || 0),
        commentsCount: Number(r.commentsCount || 0),
        mentionedAt: new Date(r.mentionedAt as string),
        createdAt: new Date(r.createdAt as string),
      };
    });
  } catch (error) {
    console.error("Error fetching project mentions:", error);
    return [];
  }
}

export async function getRecentSocialMentions(limit: number = 30): Promise<RecentProjectMention[]> {
  try {
    const result = await db.execute(sql`
      SELECT m.id, m.project_id as "projectId", m.source, m.author, m.author_avatar_url as "authorAvatarUrl", 
             m.content, m.url, m.score, m.comments_count as "commentsCount", m.mentioned_at as "mentionedAt",
             p.slug as "projectSlug", p.full_name as "projectFullName", p.name as "projectName", p.source as "projectSource"
      FROM project_mentions m
      JOIN projects p ON m.project_id = p.id
      ORDER BY m.mentioned_at DESC
      LIMIT ${limit};
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        projectId: String(r.projectId),
        source: String(r.source),
        author: String(r.author),
        authorAvatarUrl: r.authorAvatarUrl ? String(r.authorAvatarUrl) : undefined,
        content: String(r.content),
        url: String(r.url),
        score: Number(r.score || 0),
        commentsCount: Number(r.commentsCount || 0),
        mentionedAt: new Date(r.mentionedAt as string),
        projectSlug: String(r.projectSlug),
        projectFullName: String(r.projectFullName),
        projectName: String(r.projectName),
        projectSource: String(r.projectSource) as ProjectSource,
      };
    });
  } catch (error) {
    console.error("Error fetching recent social mentions:", error);
    return [];
  }
}

export async function getSimilarProjects(projectId: string, limit: number = 3): Promise<RankedProject[]> {
  await ensureCategoriesLoaded();
  try {
    const targetProject = await getProjectById(projectId);
    if (!targetProject) return [];

    const targetCategories = targetProject.categories || [];
    const categoriesArray = targetCategories.length > 0
      ? sql`p.categories ?| array[${sql.join(targetCategories.map(c => sql`${c}`), sql`, `)}]::text[]`
      : sql`false`;

    const targetTopics = targetProject.topics || [];
    const topicsArray = targetTopics.length > 0
      ? sql`p.topics ?| array[${sql.join(targetTopics.map(t => sql`${t}`), sql`, `)}]::text[]`
      : sql`false`;

    const targetLang = targetProject.primaryLanguage;
    const langMatch = targetLang
      ? sql`p.primary_language = ${targetLang}`
      : sql`false`;

    const result = await db.execute(sql`
      WITH similarity_scored AS (
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
          p.stars, p.forks, p.downloads, p.likes, p.open_issues, p.contributors_count as current_contributors_count,
          (
            CASE WHEN ${categoriesArray} THEN 10 ELSE 0 END +
            CASE WHEN ${topicsArray} THEN 5 ELSE 0 END +
            CASE WHEN ${langMatch} THEN 3 ELSE 0 END
          ) as similarity_score
        FROM projects p
        WHERE p.id != ${projectId}::uuid
          AND (${categoriesArray} OR ${topicsArray} OR ${langMatch})
      ),
      paginated AS (
        SELECT *
        FROM similarity_scored
        ORDER BY similarity_score DESC, 
                 (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) * 5.0 + (COALESCE(downloads, 0) / 1000.0) END) DESC
        LIMIT ${limit}
      )
      SELECT 
        pg.*,
        (
          SELECT json_agg(COALESCE(stars, likes, 0) ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= CURRENT_DATE - INTERVAL '14 days'
            ORDER BY snapshot_date ASC
          ) s
        ) as sparkline_data
      FROM paginated pg;
    `);

    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: r.project_id as string,
        source: r.source as "github" | "huggingface" | "paperwithcode",
        projectType: (r.project_type || 'repository') as "repository" | "model" | "dataset",
        sourceId: r.source_id as string,
        slug: r.slug as string,
        name: r.name as string,
        fullName: r.full_name as string,
        description: (r.description as string) || '',
        aiSummary: (r.ai_summary as string) || undefined,
        homepageUrl: (r.homepage_url as string) || undefined,
        sourceUrl: r.source_url as string,
        primaryLanguage: (r.primary_language as string) || undefined,
        license: (r.license as string) || undefined,
        ownerName: r.owner_name as string,
        ownerAvatarUrl: (r.owner_avatar_url as string) || '',
        ownerType: ((r.owner_type as string) || 'user') as "user" | "org",
        topics: Array.isArray(r.topics) ? (r.topics as string[]) : [],
        createdAt: typeof r.created_at === 'string' ? r.created_at : ((r.created_at as Date)?.toISOString() || new Date().toISOString()),
        updatedAt: typeof r.updated_at === 'string' ? r.updated_at : ((r.updated_at as Date)?.toISOString() || new Date().toISOString()),
        sourceCreatedAt: typeof r.source_created_at === 'string' ? r.source_created_at : ((r.source_created_at as Date)?.toISOString() || new Date().toISOString()),
        sourceUpdatedAt: r.source_updated_at ? (typeof r.source_updated_at === 'string' ? r.source_updated_at : (r.source_updated_at as Date).toISOString()) : undefined,
        lastCrawledAt: typeof r.last_crawled_at === 'string' ? r.last_crawled_at : ((r.last_crawled_at as Date)?.toISOString() || new Date().toISOString()),
        
        rank: 0,
        score: Number(r.similarity_score || 0),
        starsGained: 0,
        forksGained: 0,
        downloadsGained: 0,
        mentionsCount: 0,
        velocityScore: 0,
        momentumScore: 0,
        
        stars: Number(r.source === 'github' ? r.stars : r.likes),
        forks: Number(r.forks || 0),
        openIssues: Number(r.open_issues || 0),
        downloads: Number(r.downloads || 0),
        watchers: 0,
        contributorsCount: Number(r.current_contributors_count || 0),
        tags: [],
        categories: (Array.isArray(r.categories) ? (r.categories as string[]) : []).map((catName: string, i: number) => {
          const meta = CATEGORY_METADATA[catName] || { icon: "🏷️", color: "#6b7280" };
          return {
            id: `cat-${r.project_id}-${i}`,
            name: catName,
            slug: catName.toLowerCase().replace(/\s+/g, '-'),
            icon: meta.icon,
            color: meta.color,
            sortOrder: i,
          };
        }),
        sparklineData: Array.isArray(r.sparkline_data) ? (r.sparkline_data as number[]) : Array.from({ length: 14 }, () => 0),
      };
    });
  } catch (error) {
    console.error("Error fetching similar projects:", error);
    return [];
  }
}



