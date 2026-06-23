import { getTranslations } from "next-intl/server";
import { fetchProjectById } from "@/app/actions";
import { CompareDashboard } from "@/components/compare/compare-dashboard";
import type { RankedProject } from "@/types";

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ ids?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Compare" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function ComparePage({ searchParams }: PageProps) {
  const { ids } = await searchParams;
  const projectIds = ids ? ids.split(",").filter(Boolean) : [];
  
  const projects: RankedProject[] = [];
  if (projectIds.length > 0) {
    try {
      const fetched = await Promise.all(
        projectIds.slice(0, 3).map(id => fetchProjectById(id))
      );
      
      fetched.forEach(p => {
        if (p) {
          projects.push({
            id: p.id,
            source: p.source,
            projectType: p.projectType,
            sourceId: p.sourceId,
            slug: p.slug,
            name: p.name,
            fullName: p.fullName,
            description: p.description || "",
            aiSummary: p.aiSummary,
            homepageUrl: p.homepageUrl || undefined,
            sourceUrl: p.sourceUrl,
            primaryLanguage: p.primaryLanguage || undefined,
            license: p.license || undefined,
            ownerName: p.ownerName,
            ownerAvatarUrl: p.ownerAvatarUrl || "",
            topics: p.topics,
            categories: p.categories.map((cName: string, i: number) => ({
              id: `cat-${p.id}-${i}`,
              name: cName,
              slug: cName.toLowerCase().replace(/\s+/g, '-'),
              icon: "🏷️",
              color: "#6b7280",
              sortOrder: i
            })),
            createdAt: p.createdAt,
            updatedAt: p.updatedAt,
            sourceCreatedAt: p.sourceCreatedAt,
            lastCrawledAt: p.lastCrawledAt,
            rank: 0,
            score: 0,
            starsGained: 0,
            forksGained: 0,
            downloadsGained: 0,
            mentionsCount: 0,
            velocityScore: 0,
            momentumScore: 0,
            stars: p.stars,
            forks: p.forks,
            openIssues: p.openIssues,
            downloads: p.downloads,
            watchers: 0,
            contributorsCount: 0,
            tags: [],
            sparklineData: Array.from({ length: 14 }, () => 0)
          } as unknown as RankedProject);
        }
      });
    } catch (e) {
      console.error("Failed to load initial comparison projects:", e);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] pt-6">
      <CompareDashboard initialProjects={projects} />
    </main>
  );
}
