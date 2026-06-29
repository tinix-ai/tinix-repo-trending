import { fetchGlobalStats, fetchCategoryStats } from "@/app/actions";
import { Layers } from "lucide-react";
import type { Category } from "@/types";
import { getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/common/category-icon";
import { StatsCards } from "@/components/stats/stats-cards";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Stats" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function StatsPage() {
  const globalStats = await fetchGlobalStats();
  const categoryStats = await fetchCategoryStats() as Category[];
  const t = await getTranslations("Stats");

  return (
    <div className="page-container py-12">
      <div className="max-w-5xl mx-auto">
        <PageHeader 
          title={t("header")} 
          subtitle={t("subtitle")} 
        />
 
        <StatsCards
          totalProjects={globalStats.totalProjects}
          trendingProjects={globalStats.trendingProjects}
          totalProjectsLabel={t("totalProjects")}
          trendingProjectsLabel={t("trending")}
        />
 
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6 flex items-center gap-2">
          <Layers className="h-6 w-6 text-emerald-500" />
          {t("byCategory")}
        </h2>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {categoryStats.map((cat: Category) => (
            <div 
              key={cat.id} 
              className="glass-card hover-spring glow-interactive p-5 flex flex-col items-center justify-center gap-2 group relative overflow-hidden"
            >
              <div 
                className="flex items-center justify-center w-12 h-12 rounded-2xl mb-2 group-hover:scale-110 group-hover:-translate-y-1 transition-all duration-300 shadow-sm" 
                style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
              >
                <CategoryIcon icon={cat.icon} name={cat.name} className="h-6 w-6" />
              </div>
              <span className="font-semibold text-[15px] text-[var(--color-ink)] line-clamp-1 text-center w-full">{cat.name}</span>
              <span className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-80)] bg-[var(--color-surface-pearl)] px-2.5 py-1 rounded-full border border-[var(--color-divider-soft)] shadow-sm tabular-nums">
                {(cat.projectCount ?? 0).toLocaleString()} {t("projectsCol") || "Dự án"}
              </span>
            </div>
          ))}
          {categoryStats.length === 0 && (
            <div className="col-span-full py-12 text-center text-[var(--color-ink-muted-48)] glass-card">
              {t("noCategories")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
