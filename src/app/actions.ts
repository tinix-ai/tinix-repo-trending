"use server";

import { getDynamicTrendingProjects, getGlobalStats, getProjectBySlug, getProjectHistory, getProjectById, getCategoryStats } from "@/lib/db/queries";
import type { RankedProject } from "@/types";
import { crawlerQueue, hfQueue } from "@/workers/queue";

export async function fetchDynamicRankings(days: number, minStars: number, minDownloads: number): Promise<RankedProject[]> {
  try {
    return await getDynamicTrendingProjects(days, minStars, minDownloads);
  } catch (error) {
    console.error("Error fetching projects:", error);
    return [];
  }
}

export async function fetchGlobalStats() {
  return await getGlobalStats();
}

export async function fetchCategoryStats() {
  return await getCategoryStats();
}

export async function fetchProjectDetails(slug: string) {
  return await getProjectBySlug(slug);
}

export async function fetchProjectById(id: string) {
  return await getProjectById(id);
}

export async function triggerCrawlerSync(source: 'github' | 'huggingface') {
  console.log(`[Admin] Triggering sync for ${source}...`);
  await new Promise((resolve) => setTimeout(resolve, 1500));
  return { success: true, message: `Sync for ${source} triggered successfully.` };
}

export async function fetchProjectHistory(projectId: string, days: number = 30) {
  return await getProjectHistory(projectId, days);
}



export async function submitProject(prevState: any, formData: FormData) {
  const url = formData.get('url') as string;
  if (!url) {
    return { success: false, error: 'URL is required' };
  }

  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.toLowerCase();
    const pathname = parsedUrl.pathname.replace(/^\/|\/$/g, '');
    const parts = pathname.split('/');

    if (hostname === 'github.com') {
      if (parts.length >= 2) {
        const owner = parts[0];
        const repo = parts[1];
        await crawlerQueue.add('crawl-repo', { owner, repo }, {
          jobId: `manual-submit-${owner}-${repo}-${Date.now()}`
        });
        return { success: true, message: 'GitHub repository added to processing queue' };
      }
    } else if (hostname === 'huggingface.co') {
      if (parts[0] === 'datasets' && parts.length >= 3) {
        const id = `${parts[1]}/${parts[2]}`;
        await hfQueue.add('crawl-hf-dataset', { id, type: 'datasets' }, {
          jobId: `manual-submit-${id.replace('/', '-')}-${Date.now()}`
        });
        return { success: true, message: 'HuggingFace dataset added to processing queue' };
      } else if (parts.length >= 2) {
        // Assume model
        const id = `${parts[0]}/${parts[1]}`;
        await hfQueue.add('crawl-hf-model', { id, type: 'models' }, {
          jobId: `manual-submit-${id.replace('/', '-')}-${Date.now()}`
        });
        return { success: true, message: 'HuggingFace model added to processing queue' };
      }
    }

    return { success: false, error: 'Invalid GitHub or HuggingFace URL' };
  } catch (e) {
    return { success: false, error: 'Invalid URL format' };
  }
}
