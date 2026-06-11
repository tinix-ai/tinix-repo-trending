import { getCategoryStats } from "@/lib/db/queries";
import { Link } from "@/i18n/routing";
import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Categories",
  description: "Browse trending open source projects by category",
};

export default async function CategoriesPage() {
  const categories = await getCategoryStats();
  return (
    <div className="page-container py-8 lg:py-12">
      <div className="max-w-3xl mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight text-zinc-50 mb-3">
          Categories
        </h1>
        <p className="text-sm text-zinc-500 leading-relaxed">
          Browse trending projects organized by domain. Each category tracks momentum from both GitHub and HuggingFace sources.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat, i) => (
          <Link
            key={cat.id}
            href={`/categories/${cat.slug}`}
            className={`card group p-6 animate-fade-in-up animate-stagger-${Math.min(i + 1, 12)}`}
          >
            <div className="flex items-start justify-between mb-4">
              <div
                className="flex items-center justify-center w-11 h-11 rounded-xl text-xl"
                style={{ backgroundColor: `${cat.color}12` }}
              >
                {cat.icon}
              </div>
              <ChevronRight className="h-4 w-4 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
            </div>

            <h2
              className="text-base font-semibold mb-1 transition-colors group-hover:text-emerald-400"
              style={{ color: cat.color }}
            >
              {cat.name}
            </h2>

            <p className="text-xs text-zinc-600 mb-3">
              {cat.projectCount} projects tracked
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
