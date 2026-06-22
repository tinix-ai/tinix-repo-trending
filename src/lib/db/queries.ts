import { db } from './index';
import { sql } from 'drizzle-orm';
import type { RankedProject } from '@/types';
import { CATEGORY_METADATA } from '../categorizer';
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
  const days = params.days ?? 7;
  const minStars = params.minStars ?? 100;
  const minDownloads = params.minDownloads ?? 1000;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const filterType = params.filterType ?? "trending";

  const filters = [];

  if (filterType === "trending") {
    filters.push(sql`momentum_score >= 0`);
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
        ROW_NUMBER() OVER(${orderFragment}) as rank
      FROM filtered
      ORDER BY rank ASC
      LIMIT ${limit} OFFSET ${offset};
    `);
  } else {
    result = await db.execute(sql`
      WITH current_snapshots AS (
        SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, open_issues, likes, downloads, snapshot_date
        FROM project_snapshots
        ORDER BY project_id, snapshot_date DESC
      ),
      previous_snapshots AS (
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
          GREATEST(c.stars - COALESCE(prev.stars, earliest.stars, c.stars), 0) as stars_gained,
          GREATEST(c.forks - COALESCE(prev.forks, earliest.forks, c.forks), 0) as forks_gained,
          GREATEST(c.contributors_count - COALESCE(prev.contributors_count, earliest.contributors_count, c.contributors_count), 0) as contributors_gained,
          GREATEST(c.likes - COALESCE(prev.likes, earliest.likes, c.likes), 0) as likes_gained,
          GREATEST(c.downloads - COALESCE(prev.downloads, earliest.downloads, c.downloads), 0) as downloads_gained,
          sh.sparkline_data,
          c.stars, c.forks, c.downloads, c.likes, c.open_issues, c.contributors_count as current_contributors_count
        FROM projects p
        JOIN current_snapshots c ON p.id = c.project_id
        LEFT JOIN previous_snapshots prev ON p.id = prev.project_id
        LEFT JOIN earliest_snapshots earliest ON p.id = earliest.project_id
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
        ROW_NUMBER() OVER(${orderFragment}) as rank
      FROM filtered
      ORDER BY rank ASC
      LIMIT ${limit} OFFSET ${offset};
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
          JOIN (
            SELECT DISTINCT ON (project_id) project_id, stars, downloads
            FROM project_snapshots
            ORDER BY project_id, snapshot_date DESC
          ) c ON p.id = c.project_id
          WHERE 
            (p.source = 'github' AND c.stars >= 100) OR
            (p.source = 'huggingface' AND c.downloads >= 1000) OR
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
        COALESCE(ps.stars, 0) as current_stars,
        COALESCE(ps.forks, 0) as current_forks,
        COALESCE(ps.open_issues, 0) as current_issues,
        COALESCE(ps.downloads, 0) as current_downloads,
        COALESCE(ps.likes, 0) as current_likes
      FROM projects p
      LEFT JOIN project_snapshots ps ON p.id = ps.project_id
        AND ps.snapshot_date = (
          SELECT MAX(snapshot_date) 
          FROM project_snapshots 
          WHERE project_id = p.id
        )
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
        COALESCE(ps.stars, 0) as current_stars,
        COALESCE(ps.forks, 0) as current_forks,
        COALESCE(ps.open_issues, 0) as current_issues,
        COALESCE(ps.downloads, 0) as current_downloads,
        COALESCE(ps.likes, 0) as current_likes
      FROM projects p
      LEFT JOIN project_snapshots ps ON p.id = ps.project_id
        AND ps.snapshot_date = (
          SELECT MAX(snapshot_date) 
          FROM project_snapshots 
          WHERE project_id = p.id
        )
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


