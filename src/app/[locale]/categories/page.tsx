import { getCategoryStats } from "@/lib/db/queries";
import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { CategoryIcon } from "@/components/common/category-icon";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "Categories" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default async function CategoriesPage() {
  const categories = await getCategoryStats();
  const t = await getTranslations("Categories");

  return (
    <div className="page-container py-8 lg:py-12">
      <div className="max-w-3xl mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-[var(--color-ink)] mb-3">
          {t("header")}
        </h1>
        <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed">
          {t("subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <Link
            key={cat.id}
            href={`/?category=${cat.slug}`}
            className={`glass-card hover-spring group p-6 animate-fade-in-up animate-stagger-${Math.min(i + 1, 12)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="flex items-center justify-center w-11 h-11 rounded-xl"
                style={{ backgroundColor: `${cat.color}12`, color: cat.color }}
              >
                <CategoryIcon icon={cat.icon} name={cat.name} className="h-5 w-5" />
              </div>
              <ChevronRight className="h-4 w-4 text-[var(--color-ink-muted-80)] group-hover:text-[var(--color-action-blue)] group-hover:translate-x-0.5 transition-all" />
            </div>

            <h2
              className="text-base font-semibold mb-1 transition-colors group-hover:text-[var(--color-action-blue)]"
              style={{ color: cat.color }}
            >
              {cat.name}
            </h2>

            <p className="text-xs text-[var(--color-ink-muted-48)] mb-3">
              {t("projectsTracked", { count: cat.projectCount })}
            </p>

            <div
              className="h-1 rounded-full"
              style={{
                background: `linear-gradient(90deg, ${cat.color}, transparent)`,
                opacity: 0.3,
              }}
            />
          </Link>
        ))}
      </div>
    </div>
  );
}
