import { MetadataRoute } from 'next'
import { getDynamicTrendingProjects } from "@/lib/db/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = 'https://tinix-trending.dev';
  
  // Get dynamic projects to add to sitemap
  const projects = await getDynamicTrendingProjects(7, 0, 0);
  
  const projectUrls = projects.map((project) => ({
    url: `${baseUrl}/en/project/${project.slug.replace(/\//g, '-')}-${project.id}`,
    lastModified: new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.8,
  }));

  return [
    {
      url: `${baseUrl}/en`,
      lastModified: new Date(),
      changeFrequency: 'hourly',
      priority: 1,
    },
    {
      url: `${baseUrl}/en/categories`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.8,
    },
    {
      url: `${baseUrl}/en/stats`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 0.6,
    },
    {
      url: `${baseUrl}/en/about`,
      lastModified: new Date(),
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    ...projectUrls
  ];
}
