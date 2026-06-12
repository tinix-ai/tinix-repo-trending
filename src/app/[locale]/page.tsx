"use client";

import { useState, useEffect, useTransition } from "react";
import type { RankedProject, ViewMode, Category } from "@/types";
import { ViewToggle } from "@/components/leaderboard/view-toggle";
import { ProjectCard } from "@/components/leaderboard/project-card";
import { ProjectTableRow } from "@/components/leaderboard/project-table-row";
import { formatNumber } from "@/lib/utils";
import { fetchDynamicRankings, fetchGlobalStats, fetchCategoryStats, fetchPopularFilters } from "../actions";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Zap,
  Filter,
  ChevronRight,
  Settings2,
  Flame,
  Database,
  Sparkles,
} from "lucide-react";
import { SearchableSelect } from "@/components/common/searchable-select";

function getPageNumbers(currentPage: number, totalPages: number): (number | string)[] {
  const pages: (number | string)[] = [];
  const maxVisiblePages = 5;

  if (totalPages <= maxVisiblePages) {
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
  } else {
    pages.push(1);

    if (currentPage > 3) {
      pages.push("...");
    }

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    if (currentPage < totalPages - 2) {
      pages.push("...");
    }

    pages.push(totalPages);
  }
  return pages;
}

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<ViewMode>("card");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  const searchParams = useSearchParams();

  // Dynamic Ranking Filters
  const [days, setDays] = useState<number>(Number(searchParams.get("days")) || 7);
  const [minStars, setMinStars] = useState<number>(100);
  const [minDownloads, setMinDownloads] = useState<number>(1000);
  
  // Pagination & Filter
  const currentPage = Number(searchParams.get("page")) || 1;
  const filterType = (searchParams.get("filter") as "trending" | "all" | "new") || "trending";
  const sortBy = (searchParams.get("sortBy") as "project" | "stars" | "trend" | "updated") || undefined;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const itemsPerPage = 20;

  const t = useTranslations("HomePage");
  const [projects, setProjects] = useState<RankedProject[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [stats, setStats] = useState({ totalProjects: 12847, trendingProjects: 2340, newProjects: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularFilters, setPopularFilters] = useState<{ languages: string[], hashtags: string[] }>({ languages: [], hashtags: [] });
  const [isPending, startTransition] = useTransition();
  const searchQuery = searchParams.get("q")?.toLowerCase() || "";
  const selectedTag = searchParams.get("tag") || "";

  const categoryParam = searchParams.get("category") || "";
  const selectedCategoryObj = categories.find(
    (c) => c.slug === categoryParam || c.name.toLowerCase().replace(/\s+/g, "-") === categoryParam
  );
  const selectedCategory = selectedCategoryObj ? selectedCategoryObj.name : "";

  const handleCategoryChange = (newCategory: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newCategory) {
      const catObj = categories.find(c => c.name === newCategory);
      if (catObj) {
        params.set("category", catObj.slug);
      } else {
        params.set("category", newCategory.toLowerCase().replace(/\s+/g, "-"));
      }
    } else {
      params.delete("category");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleFilterChange = (newFilter: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("filter", newFilter);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage > 1) {
      params.set("page", newPage.toString());
    } else {
      params.delete("page");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleDaysChange = (newDays: number) => {
    setDays(newDays);
    const params = new URLSearchParams(searchParams.toString());
    params.set("days", newDays.toString());
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleTagClear = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("tag");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSort = (column: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (sortBy === column) {
      if (sortOrder === "desc") {
        params.set("sortOrder", "asc");
      } else {
        params.delete("sortBy");
        params.delete("sortOrder");
      }
    } else {
      params.set("sortBy", column);
      params.set("sortOrder", "desc");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.ceil(totalProjects / itemsPerPage);

  useEffect(() => {
    fetchGlobalStats().then(setStats);
    fetchCategoryStats().then(setCategories);
    fetchPopularFilters().then(setPopularFilters);
  }, []);

  useEffect(() => {
    startTransition(() => {
      fetchDynamicRankings({
        days,
        minStars,
        minDownloads,
        limit: itemsPerPage,
        offset: (currentPage - 1) * itemsPerPage,
        category: selectedCategory || categoryParam,
        source: selectedSource || undefined,
        language: selectedLanguage || undefined,
        searchQuery: searchQuery || undefined,
        tag: selectedTag || undefined,
        filterType,
        sortBy,
        sortOrder
      }).then((res) => {
        setProjects(res.projects);
        setTotalProjects(res.total);
      });
    });
  }, [days, minStars, minDownloads, selectedCategory, categoryParam, selectedSource, selectedLanguage, searchQuery, selectedTag, currentPage, filterType, sortBy, sortOrder]);

  const filteredProjects = projects;

  const paginatedProjects = filteredProjects;

  const languages = popularFilters.languages;
  const hashtags = popularFilters.hashtags;
  const categoryOptions = categories.map(c => c.name);

  return (
    <div className="w-full">
      <section className="apple-tile-light w-full py-16 lg:py-24 border-b border-[var(--color-divider-soft)]">
        <div className="page-container flex flex-col lg:flex-row lg:items-end lg:justify-between gap-10">
          <div className="max-w-2xl">
            <div className="flex items-center gap-2 mb-6">
              <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-accent-dim)] bg-[var(--color-accent-dim)] px-3 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-accent)] uppercase">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--color-accent)] opacity-75" />
                  <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--color-accent)]" />
                </span>
                {t("liveTracking")}
              </div>
              <span className="text-[11px] text-[var(--color-ink-muted-80)] font-medium">
                {t("updatedHourly")}
              </span>
            </div>

            <h1 className="text-apple-hero text-[var(--color-ink)] mb-6">
              {t("heroTitle")}
              <br />
              <span className="text-[var(--color-action-blue)]">
                {t("heroHighlight")}
              </span>
            </h1>

            <p className="text-apple-lead text-[var(--color-ink-muted-80)] max-w-xl">
              {t("heroDesc")}
            </p>
          </div>

          <div className="flex gap-4 lg:gap-6 flex-wrap md:flex-nowrap justify-start lg:justify-end">
            <div className="apple-utility-card flex flex-col items-center gap-2 min-w-[120px] py-5 px-4 shadow-sm border border-[var(--color-divider-soft)]">
              <TrendingUp className="h-5 w-5 text-[var(--color-action-blue)] mb-1 shrink-0" />
              <span className="text-apple-display-lg text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.totalProjects)}
              </span>
              <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-widest font-semibold">
                {t("projects")}
              </span>
            </div>

            <div className="apple-utility-card flex flex-col items-center gap-2 min-w-[120px] py-5 px-4 shadow-sm border border-[var(--color-divider-soft)]">
              <Zap className="h-5 w-5 text-amber-500 mb-1 shrink-0" />
              <span className="text-apple-display-lg text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.trendingProjects)}
              </span>
              <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-widest font-semibold">
                {t("trending")}
              </span>
            </div>

            <div className="apple-utility-card flex flex-col items-center gap-2 min-w-[120px] py-5 px-4 shadow-sm border border-[var(--color-divider-soft)]">
              <Sparkles className="h-5 w-5 text-emerald-500 mb-1 shrink-0" />
              <span className="text-apple-display-lg text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.newProjects)}
              </span>
              <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-widest font-semibold">
                {t("new")}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="apple-tile-parchment w-full py-16">
        <div className="page-container grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">
          <div className="min-w-0">
            <div className="relative z-30 bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-2xl p-4 mb-8 shadow-sm flex flex-col gap-4">
              
              {/* Row 1: Primary Navigation & Time & Views */}
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-[var(--color-divider-soft)] pb-4 flex-wrap">
                
                <div className="flex items-center gap-4 flex-wrap">
                  {/* Type Filter */}
                  <div className="flex items-center gap-1 p-1 bg-[var(--color-canvas)] rounded-xl border border-[var(--color-hairline)] w-max">
                    <button
                      onClick={() => handleFilterChange("trending")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        filterType === "trending"
                          ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      <Flame className={`w-4 h-4 ${filterType === "trending" ? "text-orange-500" : ""}`} />
                      Trending
                    </button>
                    <button
                      onClick={() => handleFilterChange("all")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        filterType === "all"
                          ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      <Database className={`w-4 h-4 ${filterType === "all" ? "text-blue-500" : ""}`} />
                      All Projects
                    </button>
                    <button
                      onClick={() => handleFilterChange("new")}
                      className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                        filterType === "new"
                          ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      <Sparkles className={`w-4 h-4 ${filterType === "new" ? "text-yellow-500" : ""}`} />
                      New
                    </button>
                  </div>

                  {/* Time Filter */}
                  <div className="flex bg-[var(--color-surface-elevated)] p-1 rounded-xl border border-[var(--color-hairline)] w-full sm:w-auto overflow-x-auto hide-scrollbar">
                    <button
                      onClick={() => handleDaysChange(1)}
                      className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        days === 1
                          ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      Day
                    </button>
                    <button
                      onClick={() => handleDaysChange(7)}
                      className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        days === 7
                          ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      Week
                    </button>
                    <button
                      onClick={() => handleDaysChange(30)}
                      className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        days === 30
                          ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      Month
                    </button>
                    <button
                      onClick={() => handleDaysChange(9999)}
                      className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        days === 9999
                          ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                          : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                      }`}
                    >
                      All
                    </button>
                  </div>
                </div>

                {/* View Controls */}
                <div className="flex items-center gap-2 mt-4 xl:mt-0">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg border ${showAdvanced ? "bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] border-[var(--color-action-blue)]/20" : "text-[var(--color-ink-muted-80)] border-[var(--color-hairline)] hover:bg-[var(--color-surface-elevated)]"}`}
                  >
                    <Settings2 className="h-4 w-4" />
                    Advanced
                  </button>
                  <ViewToggle activeView={view} onViewChange={setView} />
                </div>
              </div>

              {/* Row 2: Dropdowns */}

              <div className="flex flex-wrap items-center gap-3">
                <SearchableSelect
                  options={["GitHub", "HuggingFace"]}
                  value={
                    selectedSource === "github" ? "GitHub" :
                    selectedSource === "huggingface" ? "HuggingFace" : ""
                  }
                  onChange={(val) => {
                    if (!val) {
                      setSelectedSource("");
                      setSelectedLanguage("");
                    } else if (val === "GitHub") {
                      setSelectedSource("github");
                    } else if (val === "HuggingFace") {
                      setSelectedSource("huggingface");
                      setSelectedLanguage("");
                    }
                  }}
                  placeholder="All Sources"
                />

                <SearchableSelect
                  options={categoryOptions}
                  value={selectedCategory}
                  onChange={handleCategoryChange}
                  placeholder="All Categories"
                />

                {(!selectedSource || selectedSource === "github") && languages.length > 0 && (
                  <SearchableSelect
                    options={languages}
                    value={selectedLanguage}
                    onChange={setSelectedLanguage}
                    placeholder="All Languages"
                  />
                )}

                {hashtags.length > 0 && (
                  <SearchableSelect
                    options={hashtags.includes(selectedTag) ? hashtags : [selectedTag, ...hashtags].filter(Boolean)}
                    value={selectedTag}
                    onChange={(val) => {
                      const params = new URLSearchParams(searchParams.toString());
                      if (val) {
                        params.set("tag", val);
                      } else {
                        params.delete("tag");
                      }
                      params.delete("page");
                      router.push(`${pathname}?${params.toString()}`);
                    }}
                    placeholder="All Hashtags"
                    prefix="#"
                  />
                )}
              </div>

              {showAdvanced && (
                <div className="pt-4 border-t border-[var(--color-divider-soft)] grid grid-cols-1 sm:grid-cols-3 gap-6 animate-in slide-in-from-top-2 fade-in duration-200">
                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                      Time Period (Days)
                    </label>
                    <div className="flex items-center gap-3">
                      <input 
                        type="range" min="1" max="90" value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="w-full accent-[var(--color-action-blue)]"
                      />
                      <span className="text-sm font-medium w-8 text-right tabular-nums">{days}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                      Min GitHub Stars
                    </label>
                    <input 
                      type="number" min="0" step="100" value={minStars}
                      onChange={(e) => setMinStars(parseInt(e.target.value) || 0)}
                      className="h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm outline-none focus:border-[var(--color-action-blue)]"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                      Min HF Downloads
                    </label>
                    <input 
                      type="number" min="0" step="1000" value={minDownloads}
                      onChange={(e) => setMinDownloads(parseInt(e.target.value) || 0)}
                      className="h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 text-sm outline-none focus:border-[var(--color-action-blue)]"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-apple-caption text-[var(--color-ink-muted-80)]">
                  {t("showing")} <span className="text-[var(--color-ink)] font-semibold">{totalProjects}</span> {t("projects").toLowerCase()}
                </p>
                {selectedTag && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] border border-[var(--color-action-blue)]/20 animate-in fade-in duration-200 select-none">
                    #{selectedTag}
                    <button
                      onClick={() => handleTagClear()}
                      className="hover:bg-[var(--color-action-blue)]/20 rounded-full p-0.5 transition-colors cursor-pointer shrink-0"
                      aria-label="Clear tag filter"
                    >
                      <span className="text-[10px] font-bold">✕</span>
                    </button>
                  </span>
                )}
              </div>
            </div>

            <div className={`transition-opacity duration-300 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {view === "card" ? (
                <div className="flex flex-col gap-4">
                  {paginatedProjects.map((project, i) => (
                    <ProjectCard key={project.id} project={project} index={i} />
                  ))}
                </div>
              ) : view === "table" ? (
                <div className="apple-utility-card overflow-hidden p-0">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-pearl)]">
                          <th className="px-4 py-4 text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider w-16 text-center">#</th>
                          
                          <th 
                            className="px-4 py-4 text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("project")}
                          >
                            <div className="flex items-center gap-1">
                              Project
                              {sortBy === "project" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden md:table-cell">Category</th>
                          
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden lg:table-cell">Language</th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("stars")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Stars
                              {sortBy === "stars" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("trend")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Daily
                              {sortBy === "trend" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("updated")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              Updated
                              {sortBy === "updated" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden sm:table-cell">Trend</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProjects.map((project, i) => (
                          <ProjectTableRow key={project.id} project={project} index={i} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="apple-utility-card divide-y divide-[var(--color-divider-soft)] p-0">
                  <div className="flex items-center gap-3 px-6 py-3 bg-[var(--color-surface-pearl)] text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider border-b border-[var(--color-divider-soft)]">
                    <span className="w-8 text-right shrink-0">#</span>
                    <span className="flex-1">Project</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="w-20 text-right">Trend</span>
                      <span className="w-24 text-right">Stars</span>
                    </div>
                  </div>
                  {paginatedProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                      className="flex items-center gap-3 px-6 py-4 hover:bg-[var(--color-divider-soft)] transition-colors"
                    >
                      <span className="text-apple-body-strong tabular-nums w-8 text-right text-[var(--color-ink-muted-80)] shrink-0">
                        {project.rank}
                      </span>
                      <span className="text-apple-body-strong truncate flex-1 font-medium">
                        {project.fullName}
                      </span>
                      <div className="flex items-center gap-4 shrink-0">
                        <span className="w-20 text-right">
                          {project.starsGained > 0 ? (
                            <span className="delta-positive text-[11px] font-medium">
                              +{formatNumber(project.starsGained)}
                            </span>
                          ) : (
                            <span className="text-xs text-[var(--color-ink-muted-80)]">—</span>
                          )}
                        </span>
                        <span className="text-apple-caption text-[var(--color-ink-muted-80)] tabular-nums w-24 text-right font-medium">
                          {project.source === "github" ? "★" : "♥"} {formatNumber(project.stars)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-elevated)] transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {getPageNumbers(currentPage, totalPages).map((page, idx) => (
                    typeof page === "number" ? (
                      <button
                        key={idx}
                        onClick={() => handlePageChange(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                          currentPage === page 
                            ? "bg-[var(--color-action-blue)] text-white" 
                            : "text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]"
                        }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={idx} className="px-2 text-sm text-[var(--color-ink-muted-80)] select-none">
                        ...
                      </span>
                    )
                  ))}
                </div>
                <button
                  onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-elevated)] transition-colors"
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <aside className="hidden xl:block space-y-8">
            {/* Categories Widget */}
            <div className="apple-utility-card p-6">
              <h2 className="text-apple-body-strong mb-6 flex items-center gap-2">
                <Filter className="h-4 w-4 text-cyan-500" />
                Categories
              </h2>
              <div className="space-y-2">
                {categories.slice(0, 8).map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${cat.slug}`}
                    className="flex items-center justify-between rounded-lg px-3 py-2.5 transition-colors hover:bg-[var(--color-divider-soft)] group"
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-[var(--color-ink-muted-80)]">{cat.icon}</span>
                      <span className="text-apple-body text-[var(--color-ink)]">{cat.name}</span>
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="text-apple-caption text-[var(--color-ink-muted-80)] tabular-nums">
                        {cat.projectCount}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--color-ink-muted-48)] group-hover:text-[var(--color-action-blue)] transition-colors" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div className="apple-utility-card p-6">
              <h2 className="text-apple-body-strong mb-6 flex items-center gap-2">
                <Zap className="h-4 w-4 text-amber-500" />
                Hot Topics
              </h2>
              <div className="flex flex-wrap gap-2">
                {["AI Agent", "MCP", "RAG", "LLM", "Coding Assistant", "Open Source", "Rust", "Agentic", "Multi-modal", "Edge AI"].map((topic) => (
                  <Link
                    key={topic}
                    href={`/?tag=${encodeURIComponent(topic)}`}
                    className="inline-flex items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1 text-apple-caption text-[var(--color-ink-muted-80)] transition-colors hover:border-[var(--color-action-blue)] hover:text-[var(--color-action-blue)] cursor-pointer"
                  >
                    #{topic}
                  </Link>
                ))}
              </div>
            </div>

            {/* About Widget */}
            <div className="apple-utility-card p-6 bg-[var(--color-surface-tile-1)] text-[var(--color-body-on-dark)] border-none">
              <h2 className="text-apple-body-strong mb-3 text-white">
                About Tinix Trending
              </h2>
              <p className="text-apple-caption text-[var(--color-ink-muted-80)] leading-relaxed mb-6">
                We track momentum across GitHub & HuggingFace to surface rising projects before they hit mainstream. Updated hourly.
              </p>
              <Link
                href="/submit"
                className="apple-btn-secondary border-white/20 text-white hover:bg-white/10 w-full flex justify-center items-center gap-2"
              >
                Submit a project
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
