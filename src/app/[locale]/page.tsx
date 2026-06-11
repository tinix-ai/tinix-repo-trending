"use client";

import { useState, useEffect, useTransition } from "react";
import type { RankedProject, ViewMode, Category } from "@/types";
import { ViewToggle } from "@/components/leaderboard/view-toggle";
import { ProjectCard } from "@/components/leaderboard/project-card";
import { ProjectTableRow } from "@/components/leaderboard/project-table-row";
import { formatNumber } from "@/lib/utils";
import { fetchDynamicRankings, fetchGlobalStats, fetchCategoryStats } from "../actions";
import { useTranslations } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import {
  TrendingUp,
  Zap,
  Filter,
  ChevronRight,
  Settings2,
} from "lucide-react";
import { SearchableSelect } from "@/components/common/searchable-select";

export default function HomePage() {
  const router = useRouter();
  const pathname = usePathname();
  const [view, setView] = useState<ViewMode>("card");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [selectedSource, setSelectedSource] = useState<string>("");
  const [selectedHashtag, setSelectedHashtag] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  // Dynamic Ranking Filters
  const [days, setDays] = useState<number>(7);
  const [minStars, setMinStars] = useState<number>(100);
  const [minDownloads, setMinDownloads] = useState<number>(1000);
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;

  const t = useTranslations("HomePage");
  const [projects, setProjects] = useState<RankedProject[]>([]);
  const [stats, setStats] = useState({ totalProjects: 12847, trendingProjects: 2340 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [isPending, startTransition] = useTransition();
  const searchParams = useSearchParams();
  const searchQuery = searchParams.get("q")?.toLowerCase() || "";

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
    router.push(`${pathname}?${params.toString()}`);
  };

  useEffect(() => {
    fetchGlobalStats().then(setStats);
    fetchCategoryStats().then(setCategories);
  }, []);

  useEffect(() => {
    startTransition(() => {
      fetchDynamicRankings(days, minStars, minDownloads).then((data) => {
        setProjects(data);
      });
    });
  }, [days, minStars, minDownloads]);

  const filteredProjects = projects.filter((p) => {
    if (searchQuery) {
      const match = p.name.toLowerCase().includes(searchQuery) || 
                    (p.description && p.description.toLowerCase().includes(searchQuery)) ||
                    (p.ownerName && p.ownerName.toLowerCase().includes(searchQuery));
      if (!match) return false;
    }

    if (selectedSource && p.source !== selectedSource) return false;
    
    // Language filter applies when source is GitHub or All
    if (selectedLanguage) {
      if (p.source !== "github" || p.primaryLanguage !== selectedLanguage) return false;
    }
    
    // Hashtag filter applies when source is HuggingFace or All
    if (selectedHashtag) {
      if (p.source !== "huggingface" || p.primaryLanguage !== selectedHashtag) return false;
    }
    
    // Category filter
    if (selectedCategory) {
      if (!p.categories?.some(c => c.name === selectedCategory)) return false;
    }

    return true;
  });

  // Reset page to 1 when filters change
  useEffect(() => {
    const timer = setTimeout(() => setCurrentPage(1), 0);
    return () => clearTimeout(timer);
  }, [selectedLanguage, selectedSource, selectedCategory, selectedHashtag, days, minStars, minDownloads]);

  const totalPages = Math.ceil(filteredProjects.length / itemsPerPage);
  const paginatedProjects = filteredProjects.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  const languages = [...new Set(projects.filter(p => p.source === 'github').map((p) => p.primaryLanguage).filter((l): l is string => !!l))].sort();
  const hashtags = [...new Set(projects.filter(p => p.source === 'huggingface').map((p) => p.primaryLanguage).filter((h): h is string => !!h))].sort();
  const categoryOptions = categories.map(c => c.name);

  return (
    <div className="w-full">
      {/* Hero Section — Edge to edge tile */}
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

          {/* Live Stats Cards */}
          <div className="flex gap-4 lg:gap-6">
            <div className="apple-utility-card flex flex-col items-center gap-2 min-w-[120px] py-6 px-4">
              <TrendingUp className="h-6 w-6 text-[var(--color-action-blue)] mb-2" />
              <span className="text-apple-display-lg text-[var(--color-ink)] tabular-nums">
                {formatNumber(stats.totalProjects)}
              </span>
              <span className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-widest font-medium">
                {t("projects")}
              </span>
            </div>
            <div className="apple-utility-card flex flex-col items-center gap-2 min-w-[120px] py-6 px-4 hidden sm:flex">
              <Zap className="h-6 w-6 text-amber-500 mb-2" />
              <span className="text-apple-display-lg text-[var(--color-ink)] tabular-nums">
                {formatNumber(stats.trendingProjects)}
              </span>
              <span className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-widest font-medium">
                {t("trending")}
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Grid — Edge to edge parchment tile */}
      <section className="apple-tile-parchment w-full py-16">
        <div className="page-container grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">
          {/* Leaderboard Column */}
          <div>
            {/* Dynamic Filters Toolbar */}
            <div className="relative z-30 bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-2xl p-4 mb-8 shadow-sm flex flex-col gap-4">
              
              {/* Top Row: Source Tabs & View Toggle */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--color-divider-soft)] pb-4">
                <div className="flex items-center gap-2 p-1 bg-[var(--color-canvas)] rounded-lg border border-[var(--color-hairline)] w-fit">
                  <button 
                    onClick={() => { setSelectedSource(""); setSelectedLanguage(""); setSelectedHashtag(""); }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${!selectedSource ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm" : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)]"}`}
                  >
                    All Sources
                  </button>
                  <button 
                    onClick={() => { setSelectedSource("github"); setSelectedHashtag(""); }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedSource === "github" ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm" : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)]"}`}
                  >
                    GitHub
                  </button>
                  <button 
                    onClick={() => { setSelectedSource("huggingface"); setSelectedLanguage(""); }}
                    className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${selectedSource === "huggingface" ? "bg-[var(--color-surface-elevated)] text-[var(--color-ink)] shadow-sm" : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)]"}`}
                  >
                    HuggingFace
                  </button>
                </div>
                
                <div className="flex items-center gap-4">
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

              {/* Second Row: Contextual Filters */}
              <div className="flex flex-wrap items-center gap-3">
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

                {(!selectedSource || selectedSource === "huggingface") && hashtags.length > 0 && (
                  <SearchableSelect
                    options={hashtags}
                    value={selectedHashtag}
                    onChange={setSelectedHashtag}
                    placeholder="All Hashtags"
                    prefix="#"
                  />
                )}
              </div>

              {/* Advanced Settings Row (Collapsible) */}
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

            {/* Results Info */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-apple-caption text-[var(--color-ink-muted-80)]">
                {t("showing")} <span className="text-[var(--color-ink)] font-semibold">{filteredProjects.length}</span> {t("projects").toLowerCase()}
              </p>
            </div>

            {/* Project List */}
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
                        <tr className="border-b border-[var(--color-divider-soft)]">
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider w-12">#</th>
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">Project</th>
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden md:table-cell">Category</th>
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden lg:table-cell">Language</th>
                          <th className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">Stars</th>
                          <th className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider">Daily</th>
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
                  {paginatedProjects.map((project) => (
                    <Link
                      key={project.id}
                      href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                      className="flex items-center gap-3 px-6 py-4 hover:bg-[var(--color-divider-soft)] transition-colors"
                    >
                      <span className="text-apple-body-strong tabular-nums w-8 text-right text-[var(--color-ink-muted-80)]">
                        {project.rank}
                      </span>
                      <span className="text-apple-body-strong truncate flex-1">
                        {project.fullName}
                      </span>
                      {project.starsGained > 0 && (
                        <span className="delta-positive text-[11px]">
                          +{formatNumber(project.starsGained)}
                        </span>
                      )}
                      <span className="text-apple-caption text-[var(--color-ink-muted-80)] tabular-nums">
                        ★ {formatNumber(project.stars)}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-medium text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-elevated)] transition-colors"
                >
                  Previous
                </button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                    <button
                      key={page}
                      onClick={() => setCurrentPage(page)}
                      className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                        currentPage === page 
                          ? "bg-[var(--color-action-blue)] text-white" 
                          : "text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]"
                      }`}
                    >
                      {page}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
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
                  <span
                    key={topic}
                    className="inline-flex items-center rounded-full border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-3 py-1 text-apple-caption text-[var(--color-ink-muted-80)] transition-colors hover:border-[var(--color-action-blue)] hover:text-[var(--color-action-blue)] cursor-pointer"
                  >
                    #{topic}
                  </span>
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
