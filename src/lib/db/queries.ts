import { db } from './index';
import { sql } from 'drizzle-orm';
import type { RankedProject } from '@/types';
import { CATEGORY_METADATA } from '../categorizer';

export async function getDynamicTrendingProjects(days: number, minStars: number, minDownloads: number): Promise<RankedProject[]> {
  const result = await db.execute(sql`
    WITH current_snapshots AS (
      SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, likes, downloads, snapshot_date
      FROM project_snapshots
      ORDER BY project_id, snapshot_date DESC
    ),
    previous_snapshots AS (
      SELECT DISTINCT ON (project_id) project_id, stars, forks, contributors_count, likes, downloads, snapshot_date
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
        p.homepage_url,
        p.source_url,
        p.primary_language,
        p.owner_name,
        p.source_created_at,
        p.categories,
        GREATEST(c.stars - COALESCE(prev.stars, 0), 0) as stars_gained,
        GREATEST(c.forks - COALESCE(prev.forks, 0), 0) as forks_gained,
        GREATEST(c.contributors_count - COALESCE(prev.contributors_count, 0), 0) as contributors_gained,
        GREATEST(c.likes - COALESCE(prev.likes, 0), 0) as likes_gained,
        GREATEST(c.downloads - COALESCE(prev.downloads, 0), 0) as downloads_gained,
        sh.sparkline_data,
        c.stars, c.forks, c.downloads, c.likes
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

  return result.map((row: any) => ({
    id: row.project_id,
    source: row.source,
    sourceId: row.source_id,
    slug: row.slug,
    name: row.name,
    fullName: row.full_name,
    description: row.description || '',
    homepageUrl: row.homepage_url || undefined,
    sourceUrl: row.source_url,
    primaryLanguage: row.primary_language || undefined,
    ownerName: row.owner_name,
    sourceCreatedAt: typeof row.source_created_at === 'string' ? row.source_created_at : (row.source_created_at?.toISOString() || new Date().toISOString()),
    
    rank: Number(row.rank),
    score: Number(row.momentum_score),
    starsGained: Number(row.source === 'github' ? row.stars_gained : row.likes_gained),
    velocityScore: Number(row.momentum_score),
    
    stars: Number(row.source === 'github' ? row.stars : row.likes),
    forks: Number(row.forks || 0),
    downloads: Number(row.downloads || 0),
    
    categories: (row.categories || []).map((catName: string, i: number) => {
      const meta = CATEGORY_METADATA[catName] || { icon: "🏷️", color: "#6b7280" };
      return {
        id: `cat-${row.project_id}-${i}`,
        name: catName,
        slug: catName.toLowerCase().replace(/\s+/g, '-'),
        icon: meta.icon,
        color: meta.color,
        sortOrder: i,
      };
    }),
    sparklineData: Array.isArray(row.sparkline_data) ? row.sparkline_data : Array.from({ length: 14 }, () => Math.floor(Math.random() * 50) + 10),
  }));
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
    
    return result.map((row: any) => {
      const meta = CATEGORY_METADATA[row.name] || { icon: "🏷️", color: "#6b7280" };
      return {
        id: row.name.toLowerCase().replace(/\s+/g, '-'),
        name: row.name,
        slug: row.name.toLowerCase().replace(/\s+/g, '-'),
        icon: meta.icon,
        color: meta.color,
        projectCount: Number(row.count),
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
        COALESCE(ps.downloads, 0) as current_downloads
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

    const row = result[0];
    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      slug: row.slug,
      name: row.name,
      fullName: row.full_name,
      description: row.description,
      readme: row.readme,
      aiSummary: row.ai_summary,
      homepageUrl: row.homepage_url,
      sourceUrl: row.source_url,
      primaryLanguage: row.primary_language,
      license: row.license,
      ownerName: row.owner_name,
      ownerAvatarUrl: row.owner_avatar_url,
      topics: row.topics || [],
      categories: row.categories || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceCreatedAt: row.source_created_at,
      lastCrawledAt: row.last_crawled_at,
      // Metrics
      stars: Number(row.current_stars),
      forks: Number(row.current_forks),
      openIssues: Number(row.current_issues),
      downloads: Number(row.current_downloads),
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
        COALESCE(ps.downloads, 0) as current_downloads
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

    const row = result[0];
    return {
      id: row.id,
      source: row.source,
      sourceId: row.source_id,
      slug: row.slug,
      name: row.name,
      fullName: row.full_name,
      description: row.description,
      readme: row.readme,
      aiSummary: row.ai_summary,
      homepageUrl: row.homepage_url,
      sourceUrl: row.source_url,
      primaryLanguage: row.primary_language,
      license: row.license,
      ownerName: row.owner_name,
      ownerAvatarUrl: row.owner_avatar_url,
      topics: row.topics || [],
      categories: row.categories || [],
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      sourceCreatedAt: row.source_created_at,
      lastCrawledAt: row.last_crawled_at,
      // Metrics
      stars: Number(row.current_stars),
      forks: Number(row.current_forks),
      openIssues: Number(row.current_issues),
      downloads: Number(row.current_downloads),
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
    
    return result.map(row => ({
      date: new Date(row.snapshot_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      stars: Number(row.stars),
      forks: Number(row.forks),
      downloads: Number(row.downloads),
      likes: Number(row.likes)
    }));
  } catch (error) {
    console.error("Error fetching project history:", error);
    return [];
  }
}

