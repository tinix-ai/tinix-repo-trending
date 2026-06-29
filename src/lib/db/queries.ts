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
  sortBy?: "project" | "stars" | "likes" | "trend" | "updated" | "views";
  sortOrder?: "asc" | "desc";
  license?: string;
  country?: string;
  owner?: string;
  projectType?: string;
}

export async function getDynamicTrendingProjects(params: ProjectQueryParams): Promise<{ projects: RankedProject[], total: number }> {
  await ensureCategoriesLoaded();
  const days = params.days ?? 7;
  const minStars = params.minStars ?? 100;
  const minDownloads = params.minDownloads ?? 1000;
  const limit = params.limit ?? 20;
  const offset = params.offset ?? 0;
  const filterType = params.filterType ?? "trending";

  let finalSearchQuery = params.searchQuery;
  let parsedLicense = params.license;
  let parsedCountry = params.country;
  let parsedOwner = params.owner;

  if (finalSearchQuery) {
    const licenseMatch = finalSearchQuery.match(/license:([^\s]+)/i);
    if (licenseMatch) {
      parsedLicense = licenseMatch[1];
      finalSearchQuery = finalSearchQuery.replace(/license:[^\s]+/i, "");
    }
    const countryMatch = finalSearchQuery.match(/country:([^\s]+)/i);
    if (countryMatch) {
      parsedCountry = countryMatch[1];
      finalSearchQuery = finalSearchQuery.replace(/country:[^\s]+/i, "");
    }
    const ownerMatch = finalSearchQuery.match(/owner:([^\s]+)/i);
    if (ownerMatch) {
      parsedOwner = ownerMatch[1];
      finalSearchQuery = finalSearchQuery.replace(/owner:[^\s]+/i, "");
    }
    finalSearchQuery = finalSearchQuery.trim();
  }

  const hasActiveSearch = !!(finalSearchQuery || parsedLicense || parsedCountry || parsedOwner);

  const filters = [];

  if (filterType === "trending") {
    if (!hasActiveSearch) {
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
  }

  if (params.category) {
    filters.push(sql`categories @> ${JSON.stringify([params.category])}::jsonb`);
  }

  if (params.source) {
    filters.push(sql`source = ${params.source}`);
  }

  if (params.projectType) {
    filters.push(sql`project_type = ${params.projectType}`);
  }

  if (params.language) {
    filters.push(sql`primary_language = ${params.language}`);
  }

  if (parsedLicense) {
    const lic = `%${parsedLicense}%`;
    filters.push(sql`license ILIKE ${lic}`);
  }

  if (parsedCountry) {
    filters.push(sql`country_code = ${parsedCountry.toUpperCase()}`);
  }

  if (parsedOwner) {
    const own = `%${parsedOwner}%`;
    filters.push(sql`owner_name ILIKE ${own}`);
  }

  if (finalSearchQuery) {
    const search = `%${finalSearchQuery}%`;
    filters.push(sql`(name ILIKE ${search} OR full_name ILIKE ${search} OR description ILIKE ${search} OR owner_name ILIKE ${search} OR slug ILIKE ${search} OR topics::text ILIKE ${search})`);
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
        orderFragment = isAsc 
          ? sql`ORDER BY (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) END) ASC NULLS FIRST` 
          : sql`ORDER BY (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) END) DESC NULLS LAST`;
        break;
      case "likes":
        orderFragment = isAsc ? sql`ORDER BY COALESCE(likes, 0) ASC NULLS FIRST` : sql`ORDER BY COALESCE(likes, 0) DESC NULLS LAST`;
        break;
      case "trend":
        orderFragment = isAsc ? sql`ORDER BY momentum_score ASC` : sql`ORDER BY momentum_score DESC`;
        break;
      case "updated":
        orderFragment = isAsc ? sql`ORDER BY source_updated_at ASC NULLS FIRST` : sql`ORDER BY source_updated_at DESC NULLS LAST`;
        break;
      case "views":
        orderFragment = isAsc ? sql`ORDER BY COALESCE(views, 0) ASC NULLS FIRST` : sql`ORDER BY COALESCE(views, 0) DESC NULLS LAST`;
        break;
    }
  } else {
    orderFragment = filterType === "new"
      ? sql`ORDER BY source_created_at DESC NULLS LAST`
      : filterType === "all"
      ? sql`ORDER BY (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) * 5.0 + (COALESCE(downloads, 0) / 1000.0) END) DESC NULLS LAST`
      : sql`ORDER BY momentum_score DESC, (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) * 5.0 + (COALESCE(downloads, 0) / 1000.0) END) DESC NULLS LAST`;
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
          p.location,
          p.country_code,
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
          p.stars, p.forks, p.downloads, p.likes, p.open_issues, p.views, p.contributors_count as current_contributors_count
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
          SELECT json_agg(CASE WHEN pg.source = 'github' THEN stars ELSE likes END ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '14 days'
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
        WHERE snapshot_date <= (timezone('Asia/Ho_Chi_Minh', now()))::date - ${days} * INTERVAL '1 day'
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
          p.location,
          p.country_code,
          CASE WHEN COALESCE(prev.stars, earliest.stars, 0) > 0 THEN GREATEST(p.stars - COALESCE(prev.stars, earliest.stars), 0) ELSE 0 END as stars_gained,
          CASE WHEN COALESCE(prev.forks, earliest.forks, 0) > 0 THEN GREATEST(p.forks - COALESCE(prev.forks, earliest.forks), 0) ELSE 0 END as forks_gained,
          CASE WHEN COALESCE(prev.contributors_count, earliest.contributors_count, 0) > 0 THEN GREATEST(p.contributors_count - COALESCE(prev.contributors_count, earliest.contributors_count), 0) ELSE 0 END as contributors_gained,
          CASE WHEN COALESCE(prev.likes, earliest.likes, 0) > 0 THEN GREATEST(p.likes - COALESCE(prev.likes, earliest.likes), 0) ELSE 0 END as likes_gained,
          CASE WHEN COALESCE(prev.downloads, earliest.downloads, 0) > 0 THEN GREATEST(p.downloads - COALESCE(prev.downloads, earliest.downloads), 0) ELSE 0 END as downloads_gained,
          p.stars, p.forks, p.downloads, p.likes, p.open_issues, p.views, p.contributors_count as current_contributors_count
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
          SELECT json_agg(CASE WHEN pg.source = 'github' THEN stars ELSE likes END ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '14 days'
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
      location: (r.location as string) || null,
      countryCode: (r.country_code as string) || null,
      
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
      views: Number(r.views || 0),
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
        (SELECT COUNT(*) FROM projects WHERE source_created_at >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '30 days') as new_projects
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

export async function getPopularLanguagesAndHashtags(source?: string) {
  try {
    const langs = await db.execute(sql`
      SELECT primary_language as name, COUNT(*) as count
      FROM projects
      WHERE source = 'github' AND primary_language IS NOT NULL AND primary_language != ''
      GROUP BY primary_language
      ORDER BY count DESC
      LIMIT 20;
    `);

    const sourceFilter = source ? sql`AND p.source = ${source}` : sql``;

    const tags = await db.execute(sql`
      SELECT t.topic as name, COUNT(*) as count
      FROM projects p,
      LATERAL jsonb_array_elements_text(p.topics) t(topic)
      WHERE p.topics IS NOT NULL 
        AND jsonb_typeof(p.topics) = 'array'
        AND t.topic NOT LIKE '%:%'
        AND LENGTH(t.topic) > 2
        AND t.topic NOT IN ('en', 'zh', 'fr', 'ja', 'ko', 'es', 'de', 'pt', 'it', 'ru')
        ${sourceFilter}
      GROUP BY t.topic
      ORDER BY count DESC
      LIMIT 500;
    `);

    const countries = await db.execute(sql`
      SELECT country_code as name, COUNT(*) as count
      FROM projects
      WHERE country_code IS NOT NULL AND country_code != '' AND country_code != 'UNKNOWN'
      GROUP BY country_code
      ORDER BY count DESC
      LIMIT 250;
    `);

    return {
      languages: langs.map(r => String(r.name)),
      hashtags: tags.map(r => String(r.name)),
      countries: countries.map(r => String(r.name).toLowerCase())
    };
  } catch (error) {
    console.error("Error fetching popular languages/hashtags:", error);
    return { languages: [], hashtags: [], countries: [] };
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
      location: (r.location as string) || null,
      countryCode: (r.country_code as string) || null,
      // Metrics
      stars: r.source === 'huggingface' ? Number(r.current_likes) : Number(r.current_stars),
      forks: Number(r.current_forks),
      openIssues: Number(r.current_issues),
      downloads: Number(r.current_downloads),
      views: Number(r.views || 0),
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
      location: (r.location as string) || null,
      countryCode: (r.country_code as string) || null,
      stars: r.source === 'huggingface' ? Number(r.current_likes) : Number(r.current_stars),
      forks: Number(r.current_forks),
      openIssues: Number(r.current_issues),
      downloads: Number(r.current_downloads),
      views: Number(r.views || 0),
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
        AND snapshot_date >= (timezone('Asia/Ho_Chi_Minh', now()))::date - ${days} * INTERVAL '1 day'
      ORDER BY snapshot_date ASC, created_at DESC
    `);
    
    return result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        date: new Date(r.snapshot_date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }),
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
        (SELECT COUNT(*) FROM projects WHERE created_at < (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '6 days') as base_count,
        TO_CHAR(d.day, 'YYYY-MM-DD') as date,
        COALESCE(p.count, 0) as new_count
      FROM (
        SELECT generate_series(
          (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '6 days',
          (timezone('Asia/Ho_Chi_Minh', now()))::date,
          '1 day'::interval
        )::date as day
      ) d
      LEFT JOIN (
        SELECT DATE(created_at) as day, COUNT(*) as count
        FROM projects
        WHERE created_at >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '6 days'
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
        date: new Date(r.date as string).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }),
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

export interface PaginatedMentionsParams {
  page?: number;
  perPage?: number;
  source?: string;
  search?: string;
  sort?: 'newest' | 'oldest' | 'score' | 'comments';
}

export interface PaginatedMentionsResult {
  data: RecentProjectMention[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

export async function getPaginatedSocialMentions(params: PaginatedMentionsParams = {}): Promise<PaginatedMentionsResult> {
  const { page = 1, perPage = 20, source, search, sort = 'newest' } = params;
  const offset = (page - 1) * perPage;

  try {
    const sourceFilter = source && source !== 'all' ? sql`AND m.source = ${source}` : sql``;
    const searchFilter = search && search.trim()
      ? sql`AND (
          m.content ILIKE ${'%' + search.trim() + '%'}
          OR m.author ILIKE ${'%' + search.trim() + '%'}
          OR p.full_name ILIKE ${'%' + search.trim() + '%'}
          OR p.name ILIKE ${'%' + search.trim() + '%'}
        )`
      : sql``;

    const orderClause = sort === 'oldest'
      ? sql`ORDER BY m.mentioned_at ASC`
      : sort === 'score'
        ? sql`ORDER BY m.score DESC, m.mentioned_at DESC`
        : sort === 'comments'
          ? sql`ORDER BY m.comments_count DESC, m.mentioned_at DESC`
          : sql`ORDER BY m.mentioned_at DESC`;

    // Count query
    const [countResult] = await db.execute(sql`
      SELECT COUNT(*)::int as total
      FROM project_mentions m
      JOIN projects p ON m.project_id = p.id
      WHERE 1=1
      ${sourceFilter}
      ${searchFilter}
    `) as { total: number }[];

    const total = Number(countResult?.total ?? 0);

    // Data query
    const result = await db.execute(sql`
      SELECT m.id, m.project_id as "projectId", m.source, m.author, m.author_avatar_url as "authorAvatarUrl",
             m.content, m.url, m.score, m.comments_count as "commentsCount", m.mentioned_at as "mentionedAt",
             p.slug as "projectSlug", p.full_name as "projectFullName", p.name as "projectName", p.source as "projectSource"
      FROM project_mentions m
      JOIN projects p ON m.project_id = p.id
      WHERE 1=1
      ${sourceFilter}
      ${searchFilter}
      ${orderClause}
      LIMIT ${perPage}
      OFFSET ${offset};
    `);

    const data = result.map(row => {
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

    return {
      data,
      total,
      page,
      perPage,
      totalPages: Math.ceil(total / perPage),
    };
  } catch (error) {
    console.error("Error fetching paginated social mentions:", error);
    return { data: [], total: 0, page, perPage, totalPages: 0 };
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
          p.location,
          p.country_code,
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
          SELECT json_agg(CASE WHEN pg.source = 'github' THEN stars ELSE likes END ORDER BY snapshot_date ASC)
          FROM (
            SELECT stars, likes, snapshot_date
            FROM project_snapshots
            WHERE project_id = pg.project_id
              AND snapshot_date >= (timezone('Asia/Ho_Chi_Minh', now()))::date - INTERVAL '14 days'
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
        location: (r.location as string) || null,
        countryCode: (r.country_code as string) || null,
        
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

export async function getProjectDynamicRank(id: string, days: number = 1): Promise<{ rank: number; total: number } | null> {
  try {
    const starsGainedCol = days === 1 ? sql`t.daily_stars` : days === 7 ? sql`t.weekly_stars` : sql`t.monthly_stars`;
    const downloadsGainedCol = days === 1 ? sql`t.daily_downloads` : days === 7 ? sql`t.weekly_downloads` : sql`t.monthly_downloads`;

    const result = await db.execute(sql`
      WITH deltas AS (
        SELECT 
          p.id as project_id,
          p.source,
          p.stars,
          p.likes,
          p.downloads,
          GREATEST(COALESCE(
            CASE 
              WHEN p.source = 'github' THEN ${starsGainedCol}
              ELSE 0
            END, 0
          ), 0) as stars_gained,
          GREATEST(COALESCE(
            CASE 
              WHEN p.source = 'huggingface' THEN ${starsGainedCol}
              ELSE 0
            END, 0
          ), 0) as likes_gained,
          GREATEST(COALESCE(${downloadsGainedCol}, 0), 0) as downloads_gained
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
      ranked AS (
        SELECT 
          project_id,
          ROW_NUMBER() OVER(ORDER BY momentum_score DESC, (CASE WHEN source = 'github' THEN COALESCE(stars, 0) ELSE COALESCE(likes, 0) * 5.0 + (COALESCE(downloads, 0) / 1000.0) END) DESC) as rank,
          COUNT(*) OVER() as total_count
        FROM scored
      )
      SELECT rank, total_count FROM ranked WHERE project_id = ${id}
      LIMIT 1
    `);

    if (result.length === 0) {
      return null;
    }

    const r = result[0];
    return {
      rank: Number(r.rank),
      total: Number(r.total_count)
    };
  } catch (error) {
    console.error("Error fetching project dynamic rank:", error);
    return null;
  }
}

export async function createCollection(title: string, description: string, projectIds: string[], notes: string[]) {
  try {
    const slugBase = title.toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/đ/g, "d")
      .replace(/Đ/g, "d")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-");
    
    const uniqueSlug = `${slugBase}-${Math.random().toString(36).substring(2, 8)}`;

    const collectionRes = await db.execute(sql`
      INSERT INTO collections (id, title, description, slug, created_at, updated_at)
      VALUES (gen_random_uuid(), ${title}, ${description}, ${uniqueSlug}, NOW(), NOW())
      RETURNING id, slug
    `);

    const collectionId = String(collectionRes[0].id);
    const collectionSlug = String(collectionRes[0].slug);

    for (let i = 0; i < projectIds.length; i++) {
      const pid = projectIds[i];
      const note = notes[i] || "";
      await db.execute(sql`
        INSERT INTO collection_projects (id, collection_id, project_id, sort_order, notes, created_at)
        VALUES (gen_random_uuid(), ${collectionId}, ${pid}, ${i + 1}, ${note}, NOW())
      `);
    }

    return { success: true, slug: collectionSlug };
  } catch (error) {
    console.error("Error creating collection:", error);
    return { success: false, error: String(error) };
  }
}

export async function getCollectionBySlug(slug: string) {
  try {
    const collectionRes = await db.execute(sql`
      SELECT * FROM collections WHERE slug = ${slug} LIMIT 1
    `);

    if (collectionRes.length === 0) return null;
    const collection = collectionRes[0];

    const projectsRes = await db.execute(sql`
      SELECT 
        cp.sort_order,
        cp.notes as curator_notes,
        p.*,
        COALESCE(p.stars, 0) as current_stars,
        COALESCE(p.forks, 0) as current_forks,
        COALESCE(p.downloads, 0) as current_downloads,
        COALESCE(p.likes, 0) as current_likes
      FROM collection_projects cp
      JOIN projects p ON cp.project_id = p.id
      WHERE cp.collection_id = ${collection.id}
      ORDER BY cp.sort_order ASC
    `);

    const formattedProjects = projectsRes.map((r: any) => {
      return {
        id: r.id as string,
        source: r.source as "github" | "huggingface" | "paperwithcode",
        projectType: (r.project_type || 'repository') as "repository" | "model" | "dataset",
        slug: r.slug as string,
        name: r.name as string,
        fullName: r.full_name as string,
        description: r.description as string,
        aiSummary: r.ai_summary as string,
        homepageUrl: r.homepage_url as string,
        sourceUrl: r.source_url as string,
        primaryLanguage: r.primary_language as string,
        license: r.license as string,
        ownerName: r.owner_name as string,
        ownerAvatarUrl: r.owner_avatar_url as string,
        topics: (r.topics as string[]) || [],
        categories: (r.categories as string[]) || [],
        location: (r.location as string) || null,
        countryCode: (r.country_code as string) || null,
        stars: r.source === 'huggingface' ? Number(r.current_likes) : Number(r.current_stars),
        forks: Number(r.current_forks),
        downloads: Number(r.current_downloads),
        views: Number(r.views || 0),
        curatorNotes: r.curator_notes as string,
        sortOrder: Number(r.sort_order)
      };
    });

    return {
      id: String(collection.id),
      title: String(collection.title),
      description: String(collection.description),
      slug: String(collection.slug),
      createdAt: String(collection.created_at),
      projects: formattedProjects
    };
  } catch (error) {
    console.error("Error fetching collection:", error);
    return null;
  }
}

export async function getRecentCollections(limit: number = 10) {
  try {
    const collectionsRes = await db.execute(sql`
      SELECT * FROM collections
      ORDER BY created_at DESC
      LIMIT ${limit}
    `);

    const result = [];
    for (const col of collectionsRes) {
      const previews = await db.execute(sql`
        SELECT p.owner_avatar_url, p.full_name, p.source
        FROM collection_projects cp
        JOIN projects p ON cp.project_id = p.id
        WHERE cp.collection_id = ${col.id}
        ORDER BY cp.sort_order ASC
        LIMIT 3
      `);

      result.push({
        id: String(col.id),
        title: String(col.title),
        description: String(col.description),
        slug: String(col.slug),
        createdAt: String(col.created_at),
        projectPreviews: previews.map((p: any) => ({
          avatarUrl: p.owner_avatar_url,
          fullName: p.full_name,
          source: p.source
        }))
      });
    }
    return result;
  } catch (error) {
    console.error("Error fetching recent collections:", error);
    return [];
  }
}

export interface UnifiedActivityItem {
  id: string;
  type: 'user_review' | 'social_mention';
  source: 'user' | 'reddit' | 'x' | 'hacker_news';
  authorName: string;
  authorAvatarUrl?: string;
  content: string;
  createdAt: Date;
  rating?: number;        // user_review
  score?: number;         // social_mention
  commentsCount?: number; // social_mention
  projectName: string;
  projectSlug: string;
  projectSource: string;
  projectId: string;
  url?: string;
}

export interface UnifiedActivityParams {
  page?: number;
  perPage?: number;
  source?: 'all' | 'user' | 'reddit' | 'x' | 'hacker_news';
  search?: string;
  sort?: 'newest' | 'popular';
}

export async function getUnifiedCommunityFeed(params: UnifiedActivityParams = {}): Promise<{ data: UnifiedActivityItem[]; total: number; totalPages: number }> {
  const { page = 1, perPage = 20, source = 'all', search, sort = 'newest' } = params;
  const offset = (page - 1) * perPage;

  try {
    const searchVal = search && search.trim() ? `%${search.trim()}%` : null;

    // Build the query fragments dynamically
    const includeReviews = source === 'all' || source === 'user';
    const includeMentions = source === 'all' || source !== 'user';

    const reviewSearchCond = searchVal 
      ? sql`AND (r.review_text ILIKE ${searchVal} OR u.username ILIKE ${searchVal} OR p.name ILIKE ${searchVal})`
      : sql``;
    
    const mentionSearchCond = searchVal
      ? sql`AND (m.content ILIKE ${searchVal} OR m.author ILIKE ${searchVal} OR p.name ILIKE ${searchVal})`
      : sql``;

    const mentionSourceCond = source !== 'all' && source !== 'user'
      ? sql`AND m.source = ${source}`
      : sql``;

    const queries = [];
    if (includeReviews) {
      queries.push(sql`
        SELECT 
          r.id::text as "id",
          'user_review' as "type",
          'user' as "source",
          u.username as "authorName",
          NULL::text as "authorAvatarUrl",
          r.review_text as "content",
          r.created_at as "createdAt",
          r.rating as "rating",
          NULL::int as "score",
          NULL::int as "commentsCount",
          p.name as "projectName",
          p.slug as "projectSlug",
          p.source as "projectSource",
          p.id::text as "projectId",
          NULL::text as "url"
        FROM project_reviews r
        JOIN users u ON r.user_id = u.id
        JOIN projects p ON r.project_id = p.id
        WHERE 1=1 ${reviewSearchCond}
      `);
    }

    if (includeMentions) {
      queries.push(sql`
        SELECT 
          m.id::text as "id",
          'social_mention' as "type",
          m.source as "source",
          m.author as "authorName",
          m.author_avatar_url as "authorAvatarUrl",
          m.content as "content",
          m.mentioned_at as "createdAt",
          NULL::int as "rating",
          m.score as "score",
          m.comments_count as "commentsCount",
          p.name as "projectName",
          p.slug as "projectSlug",
          p.source as "projectSource",
          p.id::text as "projectId",
          m.url as "url"
        FROM project_mentions m
        JOIN projects p ON m.project_id = p.id
        WHERE 1=1 ${mentionSourceCond} ${mentionSearchCond}
      `);
    }

    if (queries.length === 0) {
      return { data: [], total: 0, totalPages: 0 };
    }

    const unionSql = sql.join(queries, sql` UNION ALL `);

    // Count query
    const countSql = sql`
      SELECT COUNT(*)::int as total
      FROM (${unionSql}) q
    `;
    const [countResult] = await db.execute(countSql) as { total: number }[];
    const total = Number(countResult?.total ?? 0);
    const totalPages = Math.ceil(total / perPage);

    // Order clause
    const orderClause = sort === 'popular'
      ? sql`ORDER BY COALESCE(q.score, q.rating * 10, 0) DESC, q."createdAt" DESC`
      : sql`ORDER BY q."createdAt" DESC`;

    // Data query
    const dataSql = sql`
      SELECT * FROM (${unionSql}) q
      ${orderClause}
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

    const result = await db.execute(dataSql);

    const data: UnifiedActivityItem[] = result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        type: r.type as 'user_review' | 'social_mention',
        source: r.source as 'user' | 'reddit' | 'x' | 'hacker_news',
        authorName: String(r.authorName),
        authorAvatarUrl: r.authorAvatarUrl ? String(r.authorAvatarUrl) : undefined,
        content: String(r.content),
        createdAt: new Date(r.createdAt as string),
        rating: r.rating !== null ? Number(r.rating) : undefined,
        score: r.score !== null ? Number(r.score) : undefined,
        commentsCount: r.commentsCount !== null ? Number(r.commentsCount) : undefined,
        projectName: String(r.projectName),
        projectSlug: String(r.projectSlug),
        projectSource: String(r.projectSource),
        projectId: String(r.projectId),
        url: r.url ? String(r.url) : undefined,
      };
    });

    return { data, total, totalPages };
  } catch (error) {
    console.error("Error fetching unified community feed:", error);
    return { data: [], total: 0, totalPages: 0 };
  }
}

export interface ForumThread {
  id: string;
  name: string;
  fullName: string;
  slug: string;
  description: string | null;
  ownerAvatarUrl: string | null;
  totalActivity: number;
  lastActivityTime: Date | null;
  source: string;
  projectType: string;
  stars: number;
  forks: number;
  downloads: number;
  likes: number;
  lastActivity?: {
    type: 'user' | 'reddit' | 'x' | 'hacker_news';
    author: string;
    time: Date;
  } | null;
}

export interface ForumCategory {
  id: string;
  icon: string;
  color: string;
  threads: ForumThread[];
}

export async function getForumCategoriesWithThreads(): Promise<ForumCategory[]> {
  try {
    const cats = await db.execute(sql`SELECT * FROM categories`);
    const result: ForumCategory[] = [];
    
    for (const cat of cats) {
      const catId = String(cat.id);
      
      const threadsQuery = sql`
        SELECT 
          p.id, p.name, p.full_name as "fullName", p.slug, p.description, p.owner_avatar_url,
          p.source, p.project_type as "projectType", p.stars, p.forks, p.downloads, p.likes,
          COALESCE(r.count, 0) as reviews_count,
          COALESCE(m.count, 0) as mentions_count,
          (COALESCE(r.count, 0) + COALESCE(m.count, 0))::int as "totalActivity",
          GREATEST(r.last_time, m.last_time) as "lastActivityTime"
        FROM projects p
        LEFT JOIN (
          SELECT project_id, COUNT(*)::int as count, MAX(created_at) as last_time
          FROM project_reviews
          GROUP BY project_id
        ) r ON p.id = r.project_id
        LEFT JOIN (
          SELECT project_id, COUNT(*)::int as count, MAX(mentioned_at) as last_time
          FROM project_mentions
          GROUP BY project_id
        ) m ON p.id = m.project_id
        WHERE p.categories @> ${JSON.stringify([catId])}::jsonb
        ORDER BY "totalActivity" DESC, "lastActivityTime" DESC NULLS LAST
        LIMIT 5
      `;
      
      const threadsRes = await db.execute(threadsQuery);
      const threads: ForumThread[] = [];
      
      for (const t of threadsRes) {
        const projectId = String(t.id);
        
        const lastActQuery = sql`
          SELECT q.type, q.author, q.time
          FROM (
            (
              SELECT 'user' as type, u.username as author, r.created_at as time
              FROM project_reviews r
              JOIN users u ON r.user_id = u.id
              WHERE r.project_id = ${projectId}
              ORDER BY r.created_at DESC
              LIMIT 1
            )
            UNION ALL
            (
              SELECT m.source as type, m.author, m.mentioned_at as time
              FROM project_mentions m
              WHERE m.project_id = ${projectId}
              ORDER BY m.mentioned_at DESC
              LIMIT 1
            )
          ) q
          ORDER BY q.time DESC
          LIMIT 1
        `;
        
        const [lastActRes] = await db.execute(lastActQuery) as any[];
        
        threads.push({
          id: projectId,
          name: String(t.name),
          fullName: String(t.fullName),
          slug: String(t.slug),
          description: t.description ? String(t.description) : null,
          ownerAvatarUrl: t.owner_avatar_url ? String(t.owner_avatar_url) : null,
          totalActivity: Number(t.totalActivity),
          lastActivityTime: t.lastActivityTime ? new Date(t.lastActivityTime as string) : null,
          source: String(t.source),
          projectType: String(t.projectType),
          stars: Number(t.stars || 0),
          forks: Number(t.forks || 0),
          downloads: Number(t.downloads || 0),
          likes: Number(t.likes || 0),
          lastActivity: lastActRes ? {
            type: lastActRes.type as any,
            author: String(lastActRes.author),
            time: new Date(lastActRes.time as string)
          } : null
        });
      }
      
      result.push({
        id: catId,
        icon: String(cat.icon),
        color: String(cat.color),
        threads
      });
    }
    
    return result;
  } catch (error) {
    console.error("Error fetching forum categories with threads:", error);
    return [];
  }
}

export async function getCategoryProjectsForForum(categorySlug: string, params: { page?: number; perPage?: number } = {}): Promise<{ data: ForumThread[]; total: number; totalPages: number; categoryName: string }> {
  const { page = 1, perPage = 20 } = params;
  const offset = (page - 1) * perPage;
  try {
    const cats = await db.execute(sql`SELECT id FROM categories`);
    const match = cats.find(c => String(c.id).toLowerCase().replace(/\s+/g, '-') === categorySlug.toLowerCase());
    
    if (!match) {
      return { data: [], total: 0, totalPages: 0, categoryName: categorySlug };
    }
    const categoryId = String(match.id);

    const countQuery = sql`
      SELECT COUNT(*)::int as total
      FROM projects p
      WHERE p.categories @> ${JSON.stringify([categoryId])}::jsonb
    `;
    const [countRes] = await db.execute(countQuery) as { total: number }[];
    const total = Number(countRes?.total ?? 0);
    const totalPages = Math.ceil(total / perPage);

    const query = sql`
      SELECT 
        p.id, p.name, p.full_name as "fullName", p.slug, p.description, p.owner_avatar_url,
        p.source, p.project_type as "projectType", p.stars, p.forks, p.downloads, p.likes,
        COALESCE(r.count, 0) as reviews_count,
        COALESCE(m.count, 0) as mentions_count,
        (COALESCE(r.count, 0) + COALESCE(m.count, 0))::int as "totalActivity",
        GREATEST(r.last_time, m.last_time) as "lastActivityTime"
      FROM projects p
      LEFT JOIN (
        SELECT project_id, COUNT(*)::int as count, MAX(created_at) as last_time
        FROM project_reviews
        GROUP BY project_id
      ) r ON p.id = r.project_id
      LEFT JOIN (
        SELECT project_id, COUNT(*)::int as count, MAX(mentioned_at) as last_time
        FROM project_mentions
        GROUP BY project_id
      ) m ON p.id = m.project_id
      WHERE p.categories @> ${JSON.stringify([categoryId])}::jsonb
      ORDER BY "totalActivity" DESC, "lastActivityTime" DESC NULLS LAST
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

    const threadsRes = await db.execute(query);
    const data: ForumThread[] = [];

    for (const t of threadsRes) {
      const projectId = String(t.id);
      
      const lastActQuery = sql`
        SELECT q.type, q.author, q.time
        FROM (
          (
            SELECT 'user' as type, u.username as author, r.created_at as time
            FROM project_reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.project_id = ${projectId}
            ORDER BY r.created_at DESC
            LIMIT 1
          )
          UNION ALL
          (
            SELECT m.source as type, m.author, m.mentioned_at as time
            FROM project_mentions m
            WHERE m.project_id = ${projectId}
            ORDER BY m.mentioned_at DESC
            LIMIT 1
          )
        ) q
        ORDER BY q.time DESC
        LIMIT 1
      `;
      
      const [lastActRes] = await db.execute(lastActQuery) as any[];
      
      data.push({
        id: projectId,
        name: String(t.name),
        fullName: String(t.fullName),
        slug: String(t.slug),
        description: t.description ? String(t.description) : null,
        ownerAvatarUrl: t.owner_avatar_url ? String(t.owner_avatar_url) : null,
        totalActivity: Number(t.totalActivity),
        lastActivityTime: t.lastActivityTime ? new Date(t.lastActivityTime as string) : null,
        source: String(t.source),
        projectType: String(t.projectType),
        stars: Number(t.stars || 0),
        forks: Number(t.forks || 0),
        downloads: Number(t.downloads || 0),
        likes: Number(t.likes || 0),
        lastActivity: lastActRes ? {
          type: lastActRes.type as any,
          author: String(lastActRes.author),
          time: new Date(lastActRes.time as string)
        } : null
      });
    }

    return { data, total, totalPages, categoryName: categoryId };
  } catch (error) {
    console.error("Error fetching category projects for forum:", error);
    return { data: [], total: 0, totalPages: 0, categoryName: categorySlug };
  }
}

export async function getProjectThreadDetails(slug: string) {
  try {
    const [project] = await db.execute(sql`
      SELECT id, name, full_name as "fullName", slug, description, ai_summary as "aiSummary", 
             owner_avatar_url as "ownerAvatarUrl", source, source_url as "sourceUrl", 
             homepage_url as "homepageUrl", stars, likes, views
      FROM projects
      WHERE slug = ${slug}
      LIMIT 1
    `) as any[];
    return project || null;
  } catch (error) {
    console.error("Error fetching project thread details:", error);
    return null;
  }
}

export async function getProjectThreadReplies(projectId: string, params: { page?: number; perPage?: number } = {}): Promise<{ data: UnifiedActivityItem[]; total: number; totalPages: number }> {
  const { page = 1, perPage = 20 } = params;
  const offset = (page - 1) * perPage;

  try {
    const reviewSql = sql`
      SELECT 
        r.id::text as "id",
        'user_review' as "type",
        'user' as "source",
        u.username as "authorName",
        NULL::text as "authorAvatarUrl",
        r.review_text as "content",
        r.created_at as "createdAt",
        r.rating as "rating",
        NULL::int as "score",
        NULL::int as "commentsCount",
        p.name as "projectName",
        p.slug as "projectSlug",
        p.source as "projectSource",
        p.id::text as "projectId",
        NULL::text as "url"
      FROM project_reviews r
      JOIN users u ON r.user_id = u.id
      JOIN projects p ON r.project_id = p.id
      WHERE r.project_id = ${projectId}
    `;

    const mentionSql = sql`
      SELECT 
        m.id::text as "id",
        'social_mention' as "type",
        m.source as "source",
        m.author as "authorName",
        m.author_avatar_url as "authorAvatarUrl",
        m.content as "content",
        m.mentioned_at as "createdAt",
        NULL::int as "rating",
        m.score as "score",
        m.comments_count as "commentsCount",
        p.name as "projectName",
        p.slug as "projectSlug",
        p.source as "projectSource",
        p.id::text as "projectId",
        m.url as "url"
      FROM project_mentions m
      JOIN projects p ON m.project_id = p.id
      WHERE m.project_id = ${projectId}
    `;

    const unionSql = sql.join([reviewSql, mentionSql], sql` UNION ALL `);

    const countSql = sql`SELECT COUNT(*)::int as total FROM (${unionSql}) q`;
    const [countResult] = await db.execute(countSql) as { total: number }[];
    const total = Number(countResult?.total ?? 0);
    const totalPages = Math.ceil(total / perPage);

    const dataSql = sql`
      SELECT * FROM (${unionSql}) q
      ORDER BY q."createdAt" ASC
      LIMIT ${perPage}
      OFFSET ${offset}
    `;

    const result = await db.execute(dataSql);

    const data: UnifiedActivityItem[] = result.map(row => {
      const r = row as Record<string, unknown>;
      return {
        id: String(r.id),
        type: r.type as 'user_review' | 'social_mention',
        source: r.source as 'user' | 'reddit' | 'x' | 'hacker_news',
        authorName: String(r.authorName),
        authorAvatarUrl: r.authorAvatarUrl ? String(r.authorAvatarUrl) : undefined,
        content: String(r.content),
        createdAt: new Date(r.createdAt as string),
        rating: r.rating !== null ? Number(r.rating) : undefined,
        score: r.score !== null ? Number(r.score) : undefined,
        commentsCount: r.commentsCount !== null ? Number(r.commentsCount) : undefined,
        projectName: String(r.projectName),
        projectSlug: String(r.projectSlug),
        projectSource: String(r.projectSource),
        projectId: String(r.projectId),
        url: r.url ? String(r.url) : undefined,
      };
    });

    return { data, total, totalPages };
  } catch (error) {
    console.error("Error fetching project thread replies:", error);
    return { data: [], total: 0, totalPages: 0 };
  }
}





