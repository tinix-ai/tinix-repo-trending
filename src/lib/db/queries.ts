import { db } from './index';
import { sql } from 'drizzle-orm';
import type { RankedProject } from '@/types';
import { CATEGORY_METADATA } from '../categorizer';

export async function getDynamicTrendingProjects(days: number, minStars: number, minDownloads: number): Promise<RankedProject[]> {
  const result = await db.execute(sql`
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
        p.categories,
        GREATEST(c.stars - COALESCE(prev.stars, 0), 0) as stars_gained,
        GREATEST(c.forks - COALESCE(prev.forks, 0), 0) as forks_gained,
        GREATEST(c.contributors_count - COALESCE(prev.contributors_count, 0), 0) as contributors_gained,
        GREATEST(c.likes - COALESCE(prev.likes, 0), 0) as likes_gained,
        GREATEST(c.downloads - COALESCE(prev.downloads, 0), 0) as downloads_gained,
        sh.sparkline_data,
        c.stars, c.forks, c.downloads, c.likes, c.open_issues, c.contributors_count as current_contributors_count
      FROM projects p
      JOIN current_snapshots c ON p.id = c.project_id
      LEFT JOIN previous_snapshots prev ON p.id = prev.project_id
      LEFT JOIN sparkline_history sh ON p.id = sh.project_id
    ),
    scored AS (
      SELECT 
        *,
        CASE 
          WHEN source = 'github' THEN stars_gained + (forks_gained * 2.0) + (contributors_gained * 5.0)
          WHEN source = 'huggingface' THEN likes_gained + (downloads_gained / 1000.0)
          ELSE 0 
        END as momentum_score
      FROM deltas
    ),
    filtered AS (
      SELECT * FROM scored
      WHERE momentum_score >= 0
        AND (
          (source = 'github' AND stars >= ${minStars}) 
          OR (source = 'huggingface' AND downloads >= ${minDownloads})
          OR (source NOT IN ('github', 'huggingface'))
        )
    )
    SELECT 
      *,
      ROW_NUMBER() OVER(ORDER BY momentum_score DESC) as rank
    FROM filtered
    ORDER BY rank ASC
    LIMIT 100;
  `);

  return result.map(row => {
    const r = row as Record<string, unknown>;
    return {
      id: r.project_id as string,
      source: r.source as "github" | "huggingface" | "paperwithcode",
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
      lastCrawledAt: typeof r.last_crawled_at === 'string' ? r.last_crawled_at : ((r.last_crawled_at as Date)?.toISOString() || new Date().toISOString()),
      
      rank: Number(r.rank),
      score: Number(r.momentum_score),
      starsGained: Number(r.source === 'github' ? r.stars_gained : r.likes_gained),
      forksGained: Number(r.source === 'github' ? r.forks_gained : 0),
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
}

export async function getGlobalStats() {
  try {
    const result = await db.execute(sql`
      SELECT 
        (SELECT COUNT(*) FROM projects) as total_projects,
        (SELECT COUNT(DISTINCT project_id) FROM project_snapshots WHERE snapshot_date >= CURRENT_DATE - INTERVAL '7 days') as trending_projects
    `);
    return {
      totalProjects: Number(result[0]?.total_projects || 0),
      trendingProjects: Number(result[0]?.trending_projects || 0)
    };
  } catch (error) {
    console.error("Error fetching stats:", error);
    return { totalProjects: 0, trendingProjects: 0 };
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
      sourceId: r.source_id as string,
      slug: r.slug as string,
      name: r.name as string,
      fullName: r.full_name as string,
      description: r.description as string,
      readme: r.readme as string,
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
      sourceId: r.source_id as string,
      slug: r.slug as string,
      name: r.name as string,
      fullName: r.full_name as string,
      description: r.description as string,
      readme: r.readme as string,
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
      SELECT 
        snapshot_date,
        stars,
        forks,
        downloads,
        likes
      FROM project_snapshots
      WHERE project_id = ${projectId}
        AND snapshot_date >= CURRENT_DATE - ${days} * INTERVAL '1 day'
      ORDER BY snapshot_date ASC
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

