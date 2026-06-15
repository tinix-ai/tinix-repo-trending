import { fetchGlobalStats, fetchCategoryStats } from "@/app/actions";
import { Database, TrendingUp, Layers } from "lucide-react";
import type { Category } from "@/types";
import { getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/common/category-icon";

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
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] mb-3">
          {t("header")}
        </h1>
        <p className="text-[var(--color-ink-muted-80)] mb-10">
          {t("subtitle")}
        </p>
 
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          <div className="apple-utility-card p-6 flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500">
              <Database className="h-8 w-8" />
            </div>
            <div>
              <p className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-1">
                {t("totalProjects")}
              </p>
              <p className="text-4xl font-bold text-[var(--color-ink)] tabular-nums">
                {globalStats.totalProjects.toLocaleString()}
              </p>
            </div>
          </div>
 
          <div className="apple-utility-card p-6 flex items-center gap-6">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500">
              <TrendingUp className="h-8 w-8" />
            </div>
            <div>
              <p className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-1">
                {t("trending")}
              </p>
              <p className="text-4xl font-bold text-[var(--color-ink)] tabular-nums">
                {globalStats.trendingProjects.toLocaleString()}
              </p>
            </div>
          </div>
        </div>
 
        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-6 flex items-center gap-2">
          <Layers className="h-6 w-6 text-emerald-500" />
          {t("byCategory")}
        </h2>
        
        <div className="apple-utility-card p-0 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--color-hairline)] bg-[var(--color-surface-elevated)]">
                <th className="py-3 px-6 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">{t("categoryCol")}</th>
                <th className="py-3 px-6 text-xs font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider text-right">{t("projectsCol")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--color-hairline)]">
              {categoryStats.map((cat: Category) => (
                <tr key={cat.id} className="hover:bg-[var(--color-divider-soft)] transition-colors">
                  <td className="py-4 px-6 flex items-center gap-3">
                    <span 
                      className="flex items-center justify-center w-7 h-7 rounded-lg" 
                      style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                    >
                      <CategoryIcon icon={cat.icon} name={cat.name} className="h-4 w-4" />
                    </span>
                    <span className="font-medium text-[var(--color-ink)]">{cat.name}</span>
                  </td>
                  <td className="py-4 px-6 text-right font-medium tabular-nums text-[var(--color-ink-muted-80)]">
                    {(cat.projectCount ?? 0).toLocaleString()}
                  </td>
                </tr>
              ))}
              {categoryStats.length === 0 && (
                <tr>
                  <td colSpan={2} className="py-8 text-center text-[var(--color-ink-muted-48)]">
                    {t("noCategories")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
