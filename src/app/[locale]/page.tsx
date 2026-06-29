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
import { useSearchParams, useParams } from "next/navigation";
import {
  TrendingUp,
  Zap,
  Filter,
  ChevronRight,
  Settings2,
  Flame,
  Database,
  Sparkles,
  Github,
  Search,
  Box,
  HardDrive,
} from "lucide-react";
import { SearchableSelect } from "@/components/common/searchable-select";
import { CategoryIcon } from "@/components/common/category-icon";
import { ComparisonDrawer } from "@/components/leaderboard/comparison-drawer";
import { TopRankedGrid } from "@/components/leaderboard/top-ranked-grid";

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
  const params = useParams();
  const locale = (params?.locale as string) || "vi";
  const [view, setView] = useState<ViewMode>("card");
  const [selectedLanguage, setSelectedLanguage] = useState<string>("");
  const [showAdvanced, setShowAdvanced] = useState<boolean>(false);
  
  const searchParams = useSearchParams();
  const selectedSource = searchParams.get("source") || "github";

  // Advanced Search States
  const [searchValue, setSearchValue] = useState<string>(searchParams.get("q") || "");
  const [advLicense, setAdvLicense] = useState<string>(searchParams.get("license") || "");
  const [advCountry, setAdvCountry] = useState<string>(searchParams.get("country") || "");
  const [advOwner, setAdvOwner] = useState<string>(searchParams.get("owner") || "");
  const [showAdvancedSearch, setShowAdvancedSearch] = useState<boolean>(false);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    const lic = searchParams.get("license") || "";
    const cty = searchParams.get("country") || "";
    const own = searchParams.get("owner") || "";

    Promise.resolve().then(() => {
      setSearchValue(q);
      setAdvLicense(lic);
      setAdvCountry(cty);
      setAdvOwner(own);
    });
  }, [searchParams]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());
    
    let cleanQ = searchValue;
    const licenseMatch = cleanQ.match(/license:([^\s]+)/i);
    let parsedLic = advLicense;
    if (licenseMatch) {
      parsedLic = licenseMatch[1];
      cleanQ = cleanQ.replace(/license:[^\s]+/i, "");
    }
    const countryMatch = cleanQ.match(/country:([^\s]+)/i);
    let parsedCty = advCountry;
    if (countryMatch) {
      parsedCty = countryMatch[1];
      cleanQ = cleanQ.replace(/country:[^\s]+/i, "");
    }
    const ownerMatch = cleanQ.match(/owner:([^\s]+)/i);
    let parsedOwn = advOwner;
    if (ownerMatch) {
      parsedOwn = ownerMatch[1];
      cleanQ = cleanQ.replace(/owner:[^\s]+/i, "");
    }
    
    cleanQ = cleanQ.trim();
    
    if (cleanQ) params.set("q", cleanQ);
    else params.delete("q");
    
    if (parsedLic) params.set("license", parsedLic);
    else params.delete("license");
    
    if (parsedCty) params.set("country", parsedCty);
    else params.delete("country");
    
    if (parsedOwn) params.set("owner", parsedOwn);
    else params.delete("owner");
    
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleApplySearch = () => {
    const params = new URLSearchParams(searchParams.toString());
    
    if (searchValue.trim()) params.set("q", searchValue.trim());
    else params.delete("q");
    
    if (advLicense) params.set("license", advLicense);
    else params.delete("license");
    
    if (advCountry) params.set("country", advCountry);
    else params.delete("country");
    
    if (advOwner) params.set("owner", advOwner);
    else params.delete("owner");
    
    params.delete("page");
    setShowAdvancedSearch(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleResetSearch = () => {
    setSearchValue("");
    setAdvLicense("");
    setAdvCountry("");
    setAdvOwner("");
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    params.delete("license");
    params.delete("country");
    params.delete("owner");
    params.delete("page");
    setShowAdvancedSearch(false);
    router.push(`${pathname}?${params.toString()}`);
  };

  // Dynamic Ranking Filters
  const [days, setDays] = useState<number>(Number(searchParams.get("days")) || 1);
  const [minStars, setMinStars] = useState<number>(100);
  const [minDownloads, setMinDownloads] = useState<number>(1000);
  
  // Pagination & Filter
  const currentPage = Number(searchParams.get("page")) || 1;
  const filterType = (searchParams.get("filter") as "trending" | "all" | "new") || "trending";
  const sortBy = (searchParams.get("sortBy") as "project" | "stars" | "likes" | "trend" | "updated" | "views") || undefined;
  const sortOrder = (searchParams.get("sortOrder") as "asc" | "desc") || undefined;
  const projectType = searchParams.get("type") || "";
  const itemsPerPage = 20;

  const t = useTranslations("HomePage");
  const [projects, setProjects] = useState<RankedProject[]>([]);
  const [hotVNProjects, setHotVNProjects] = useState<RankedProject[]>([]);
  const [totalProjects, setTotalProjects] = useState(0);
  const [stats, setStats] = useState({ totalProjects: 12847, trendingProjects: 2340, newProjects: 0 });
  const [categories, setCategories] = useState<Category[]>([]);
  const [popularFilters, setPopularFilters] = useState<{ languages: string[], hashtags: string[], countries: string[] }>({ languages: [], hashtags: [], countries: [] });
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

  const handleSourceChange = (newSource: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("source", newSource);
    params.delete("page");
    params.delete("sortBy");
    params.delete("sortOrder");
    params.delete("type");
    if (newSource === "huggingface") {
      setSelectedLanguage("");
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleProjectTypeChange = (newType: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (newType) {
      params.set("type", newType);
    } else {
      params.delete("type");
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
    fetchPopularFilters(selectedSource || undefined).then(setPopularFilters);
    
    // Fetch Hot VN Projects
    fetchDynamicRankings({
      days: 1,
      limit: 10,
      country: "vn",
      filterType: "trending",
      sortBy: "trend",
      sortOrder: "desc"
    }).then(res => setHotVNProjects(res.projects));
  }, []);

  // Re-fetch popular filters when source changes
  useEffect(() => {
    fetchPopularFilters(selectedSource || undefined).then(setPopularFilters);
  }, [selectedSource]);

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
        sortOrder,
        license: searchParams.get("license") || undefined,
        country: searchParams.get("country") || undefined,
        owner: searchParams.get("owner") || undefined,
        projectType: projectType || undefined,
      }).then((res) => {
        setProjects(res.projects);
        setTotalProjects(res.total);
      });
    });
  }, [days, minStars, minDownloads, selectedCategory, categoryParam, selectedSource, selectedLanguage, searchQuery, selectedTag, currentPage, filterType, sortBy, sortOrder, searchParams, projectType]);

  const filteredProjects = projects;
  const paginatedProjects = filteredProjects;

  const getGrowthText = (project: RankedProject) => {
    const isGithub = project.source === "github";
    const gained = isGithub ? project.starsGained : (project.downloadsGained ?? 0);
    
    if (gained <= 0) return null;
    
    const formatted = formatNumber(gained);
    return `+${formatted}`;
  };

  const languages = popularFilters.languages;
  const hashtags = popularFilters.hashtags;
  const countries = popularFilters.countries || [];

  const displayNames = new Intl.DisplayNames([locale], { type: "region" });
  const countryOptions = countries.map((code) => {
    try {
      return displayNames.of(code.toUpperCase()) || code.toUpperCase();
    } catch {
      return code.toUpperCase();
    }
  });

  const selectedCountryCode = searchParams.get("country") || "";
  let selectedCountryName = "";
  if (selectedCountryCode) {
    try {
      selectedCountryName = displayNames.of(selectedCountryCode.toUpperCase()) || selectedCountryCode.toUpperCase();
    } catch {
      selectedCountryName = selectedCountryCode.toUpperCase();
    }
  }

  const handleCountryChange = (name: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (name) {
      const foundCode = countries.find((code) => {
        try {
          return displayNames.of(code.toUpperCase()) === name;
        } catch {
          return code.toUpperCase() === name;
        }
      });
      if (foundCode) {
        params.set("country", foundCode);
      } else {
        params.set("country", name.toLowerCase());
      }
    } else {
      params.delete("country");
    }
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const categoryOptions = categories.map(c => c.name);

  return (
    <div className="w-full">
      <section className="apple-tile-light w-full py-12 border-b border-[var(--color-divider-soft)]">
        <div className="page-container flex flex-col items-center text-center max-w-4xl mx-auto gap-4">
          <div className="flex flex-col items-center max-w-2xl">
            <div className="flex items-center gap-2 mb-3">
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

            <h1 className="text-apple-hero text-[var(--color-ink)] mb-3">
              {t("heroTitle")}{" "}
              <span className="text-[var(--color-action-blue)] block sm:inline">
                {t("heroHighlight")}
              </span>
            </h1>

            <p className="text-apple-lead text-[var(--color-ink-muted-80)] max-w-xl">
              {t("heroDesc")}
            </p>

            {/* Redesigned Search & Advanced Filters */}
            <div className="w-full max-w-2xl mx-auto mt-4 relative z-40">
              <form onSubmit={handleSearchSubmit} className="relative flex items-center bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-full p-1.5 transition-all duration-300 focus-within:border-[var(--color-action-blue)]">
                <div className="flex-1 flex items-center pl-4">
                  <Search className="h-5 w-5 text-[var(--color-ink-muted-48)] shrink-0" />
                  <input
                    type="text"
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    placeholder="Search projects, models, datasets..."
                    className="w-full bg-transparent border-0 outline-none text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] px-2.5 h-10"
                  />
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowAdvancedSearch(!showAdvancedSearch)}
                    className={`flex items-center justify-center h-[44px] px-4 rounded-full border text-apple-body transition-all cursor-pointer ${
                      showAdvancedSearch
                        ? "bg-[var(--color-action-blue)]/10 border-[var(--color-action-blue)]/20 text-[var(--color-action-blue)]"
                        : "border-[var(--color-hairline)] text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    <Settings2 className="h-4 w-4 sm:mr-1.5" />
                    <span className="hidden sm:inline">Advanced</span>
                  </button>
                  <button
                    type="submit"
                    className="apple-btn-primary h-[44px] cursor-pointer"
                  >
                    Search
                  </button>
                </div>
              </form>

              {/* Advanced Panel Dropdown */}
              {showAdvancedSearch && (
                <div className="absolute top-full left-0 right-0 mt-3 p-5 bg-[var(--color-canvas)] border border-[var(--color-hairline)] rounded-2xl shadow-none animate-in fade-in-50 duration-200 flex flex-col gap-4 text-left">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {/* Owner Input */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                        Owner / Org
                      </label>
                      <input
                        type="text"
                        value={advOwner}
                        onChange={(e) => setAdvOwner(e.target.value)}
                        placeholder="e.g. google, meta"
                        className="h-9 px-3 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none focus:border-[var(--color-action-blue)]"
                      />
                    </div>

                    {/* Country Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                        Country
                      </label>
                      <select
                        value={advCountry}
                        onChange={(e) => setAdvCountry(e.target.value)}
                        className="h-9 px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] cursor-pointer"
                      >
                        <option value="">Any Country</option>
                        {countries.map((code) => {
                          let name = code.toUpperCase();
                          try {
                            name = displayNames.of(code.toUpperCase()) || code.toUpperCase();
                          } catch {}
                          return (
                            <option key={code} value={code}>{name}</option>
                          );
                        })}
                      </select>
                    </div>

                    {/* License Selector */}
                    <div className="flex flex-col gap-1.5">
                      <label className="text-[10px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                        License
                      </label>
                      <select
                        value={advLicense}
                        onChange={(e) => setAdvLicense(e.target.value)}
                        className="h-9 px-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] cursor-pointer"
                      >
                        <option value="">Any License</option>
                        <option value="mit">MIT</option>
                        <option value="apache-2.0">Apache 2.0</option>
                        <option value="gpl">GPL</option>
                        <option value="bsd">BSD</option>
                        <option value="apache">Apache</option>
                      </select>
                    </div>
                  </div>

                  {/* Actions & Cheat-sheet tips */}
                  <div className="flex items-between justify-between border-t border-[var(--color-divider-soft)] pt-4 mt-1 flex-wrap gap-3">
                    <p className="text-[11px] text-[var(--color-ink-muted-80)] italic leading-none">
                      💡 Tip: type <code className="bg-[var(--color-canvas)] px-1.5 py-0.5 rounded text-blue-500 font-mono font-semibold">owner:meta</code> directly in search.
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleResetSearch}
                        className="h-8 px-4 text-xs font-semibold rounded-lg bg-[var(--color-surface-pearl)] hover:bg-[var(--color-divider-soft)] text-[var(--color-ink)] transition-colors cursor-pointer"
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        onClick={handleApplySearch}
                        className="h-8 px-4 text-xs font-semibold rounded-lg bg-[var(--color-action-blue)] text-white hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Active Filter Chips */}
              {(searchParams.get("license") || searchParams.get("country") || searchParams.get("owner")) && (
                <div className="flex flex-wrap items-center gap-1.5 mt-3 justify-center animate-in fade-in duration-200">
                  {searchParams.get("owner") && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-ink)] uppercase">
                      Owner: {searchParams.get("owner")}
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("owner");
                          params.delete("page");
                          router.push(`${pathname}?${params.toString()}`);
                        }}
                        className="hover:bg-[var(--color-divider-soft)] rounded p-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {searchParams.get("country") && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-ink)] uppercase">
                      Country: {searchParams.get("country")?.toUpperCase()}
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("country");
                          params.delete("page");
                          router.push(`${pathname}?${params.toString()}`);
                        }}
                        className="hover:bg-[var(--color-divider-soft)] rounded p-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                  {searchParams.get("license") && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-ink)] uppercase">
                      License: {searchParams.get("license")}
                      <button
                        type="button"
                        onClick={() => {
                          const params = new URLSearchParams(searchParams.toString());
                          params.delete("license");
                          params.delete("page");
                          router.push(`${pathname}?${params.toString()}`);
                        }}
                        className="hover:bg-[var(--color-divider-soft)] rounded p-0.5"
                      >
                        ✕
                      </button>
                    </span>
                  )}
                </div>
              )}

              {/* Popular/Hot Topics Row */}
              <div className="flex flex-wrap items-center justify-center gap-2 mt-4.5 text-xs animate-in fade-in duration-300">
                <span className="text-[var(--color-ink-muted-80)] flex items-center gap-1 font-semibold select-none">
                  <Flame className="h-3.5 w-3.5 text-amber-500" />
                  Trending:
                </span>
                {(hashtags.length > 0 ? hashtags.slice(0, 8) : ["AI Agent", "MCP", "RAG", "LLM", "Rust", "transformers", "llama", "docker"]).map((topic) => {
                  const isActive = selectedTag === topic;
                  return (
                    <Link
                      key={topic}
                      href={isActive ? "/" : `/?tag=${encodeURIComponent(topic)}`}
                      className={`inline-flex items-center rounded-full px-3 py-1.5 font-semibold transition-all duration-200 border cursor-pointer active:scale-95 ${
                        isActive
                          ? "bg-[var(--color-action-blue)] border-[var(--color-action-blue)] text-white shadow-md shadow-blue-500/10"
                          : "border-[var(--color-divider-soft)] bg-[var(--color-surface-elevated)]/60 text-[var(--color-ink-muted-80)] hover:border-[var(--color-action-blue)]/40 hover:text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/[0.03] hover:shadow-sm"
                      }`}
                    >
                      #{topic}
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-center divide-x divide-[var(--color-divider-soft)] apple-utility-card max-w-xl w-full mx-auto">
            <div className="flex-1 flex flex-col items-center px-2">
              <div className="flex items-center gap-1.5 text-[var(--color-action-blue)] mb-0.5">
                <TrendingUp className="h-4 w-4 shrink-0" />
                <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-wider font-semibold">
                  {t("projects")}
                </span>
              </div>
              <span className="text-lg md:text-xl text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.totalProjects)}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center px-2">
              <div className="flex items-center gap-1.5 text-amber-500 mb-0.5">
                <Zap className="h-4 w-4 shrink-0" />
                <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-wider font-semibold">
                  {t("trending")}
                </span>
              </div>
              <span className="text-lg md:text-xl text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.trendingProjects)}
              </span>
            </div>

            <div className="flex-1 flex flex-col items-center px-2">
              <div className="flex items-center gap-1.5 text-emerald-500 mb-0.5">
                <Sparkles className="h-4 w-4 shrink-0" />
                <span className="text-[10px] text-[var(--color-ink-muted-80)] uppercase tracking-wider font-semibold">
                  {t("new")}
                </span>
              </div>
              <span className="text-lg md:text-xl text-[var(--color-ink)] tabular-nums font-bold tracking-tight">
                {formatNumber(stats.newProjects)}
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="apple-tile-parchment w-full py-20">
        <div className="page-container grid grid-cols-1 xl:grid-cols-[1fr_280px] gap-8">
          <div className="min-w-0">
            {/* Platform Switcher Tabs above Filter Card */}
            <div className="flex justify-start mb-5">
              <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-elevated)] rounded-xl border border-[var(--color-divider-soft)] shadow-sm w-full sm:w-auto max-w-sm">
                <button
                  onClick={() => handleSourceChange("github")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    selectedSource === "github"
                      ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                      : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                  }`}
                >
                  <Github className="w-4 h-4" />
                  {t("githubTab")}
                </button>
                <button
                  onClick={() => handleSourceChange("huggingface")}
                  className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                    selectedSource === "huggingface"
                      ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                      : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                  }`}
                >
                  <svg 
                    className="w-4 h-4" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M18 10h-.01" />
                    <path d="M6 10h-.01" />
                    <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
                    <path d="M8 15a5 5 0 0 0 8 0" />
                  </svg>
                  {t("huggingfaceTab")}
                </button>
              </div>
            </div>

            {/* HuggingFace Project Type Sub-Filter */}
            {selectedSource === "huggingface" && (
              <div className="flex items-center gap-2 mb-5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted-48)] mr-1">Type</span>
                <div className="flex items-center gap-1 p-0.5 bg-[var(--color-surface-elevated)] rounded-lg border border-[var(--color-divider-soft)]">
                  <button
                    onClick={() => handleProjectTypeChange("")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      !projectType
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    <Database className="w-3.5 h-3.5" />
                    All
                  </button>
                  <button
                    onClick={() => handleProjectTypeChange("model")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      projectType === "model"
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    <Box className="w-3.5 h-3.5" />
                    Models
                  </button>
                  <button
                    onClick={() => handleProjectTypeChange("dataset")}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      projectType === "dataset"
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    <HardDrive className="w-3.5 h-3.5" />
                    Datasets
                  </button>
                </div>
              </div>
            )}

            {/* Filter Card */}
            <div className="relative z-30 bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-2xl p-4 mb-8 shadow-sm flex flex-col gap-4">
              
              {/* Row 1: Primary Navigation & Time */}
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-[var(--color-divider-soft)] pb-4">
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
                    {t("trendingFilter")}
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
                    {t("allProjectsFilter")}
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
                    {t("new")}
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
                    {t("dayTime")}
                  </button>
                  <button
                    onClick={() => handleDaysChange(7)}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      days === 7
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    {t("weekTime")}
                  </button>
                  <button
                    onClick={() => handleDaysChange(30)}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      days === 30
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    {t("monthTime")}
                  </button>
                  <button
                    onClick={() => handleDaysChange(9999)}
                    className={`flex-1 sm:flex-none flex items-center justify-center px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      days === 9999
                        ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
                        : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-surface-pearl)]"
                    }`}
                  >
                    {t("allTime")}
                  </button>
                </div>
              </div>

              {/* Row 2: Dropdowns & View Controls */}
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2 md:gap-3">
                  <SearchableSelect
                    options={categoryOptions}
                    value={selectedCategory}
                    onChange={handleCategoryChange}
                    placeholder={t("allCategories")}
                    className="w-full sm:w-36 md:w-[130px] lg:w-36 xl:w-[150px]"
                  />

                  {(!selectedSource || selectedSource === "github") && languages.length > 0 && (
                    <SearchableSelect
                      options={languages}
                      value={selectedLanguage}
                      onChange={setSelectedLanguage}
                      placeholder={t("allLanguages")}
                      className="w-full sm:w-36 md:w-[130px] lg:w-36 xl:w-[150px]"
                    />
                  )}

                  {countryOptions.length > 0 && (
                    <SearchableSelect
                      options={countryOptions}
                      value={selectedCountryName}
                      onChange={handleCountryChange}
                      placeholder={t("allCountries")}
                      className="w-full sm:w-36 md:w-[130px] lg:w-36 xl:w-[150px]"
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
                      placeholder={t("allHashtags")}
                      prefix="#"
                      className="w-full sm:w-36 md:w-[130px] lg:w-36 xl:w-[150px]"
                    />
                  )}
                </div>

                {/* View Controls */}
                <div className="flex items-center gap-2 mt-2 md:mt-0 shrink-0">
                  <button 
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`flex items-center gap-2 text-sm font-medium transition-colors px-3 py-1.5 rounded-lg border ${showAdvanced ? "bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] border-[var(--color-action-blue)]/20" : "text-[var(--color-ink-muted-80)] border-[var(--color-hairline)] hover:bg-[var(--color-surface-elevated)]"}`}
                  >
                    <Settings2 className="h-4 w-4" />
                    {t("advanced")}
                  </button>
                  <ViewToggle activeView={view} onViewChange={setView} />
                </div>
              </div>


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
                {selectedCountryCode && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] border border-[var(--color-action-blue)]/20 animate-in fade-in duration-200 select-none">
                    {selectedCountryName}
                    <button
                      onClick={() => handleCountryChange("")}
                      className="hover:bg-[var(--color-action-blue)]/20 rounded-full p-0.5 transition-colors cursor-pointer shrink-0"
                      aria-label="Clear country filter"
                    >
                      <span className="text-[10px] font-bold">✕</span>
                    </button>
                  </span>
                )}
              </div>

              {/* Sort Controls */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[var(--color-ink-muted-80)] font-medium hidden sm:inline">{t("sortBy")}:</span>
                <select 
                  className="h-8 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-surface-elevated)] px-2.5 py-1 text-xs outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] font-medium text-[var(--color-ink)] cursor-pointer transition-all hover:bg-[var(--color-surface-pearl)]"
                  value={sortBy && sortOrder ? `${sortBy}-${sortOrder}` : ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    const params = new URLSearchParams(searchParams.toString());
                    if (!val) {
                       params.delete("sortBy");
                       params.delete("sortOrder");
                    } else {
                      const [col, ord] = val.split("-");
                      params.set("sortBy", col);
                      params.set("sortOrder", ord);
                    }
                    params.delete("page");
                    router.push(`${pathname}?${params.toString()}`);
                  }}
                >
                  <option value="">{t("sortTrendDesc")}</option>
                  <option value="stars-desc">{t("sortStarsDesc")}</option>
                  <option value="likes-desc">{t("sortLikesDesc")}</option>
                  <option value="views-desc">{t("sortViewsDesc")}</option>
                  <option value="updated-desc">{t("sortUpdatedDesc")}</option>
                </select>
              </div>
            </div>

            <div className={`transition-opacity duration-300 ${isPending ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {view === "card" ? (
                <div className="flex flex-col gap-4">
                  {currentPage === 1 ? (
                    <>
                      {/* Top 3 Premium Grid */}
                      <TopRankedGrid 
                        projects={paginatedProjects.slice(0, 3)} 
                        days={days} 
                      />
                      
                      {/* Vị trí thứ 4 trở đi */}
                      {paginatedProjects.slice(3).map((project, i) => (
                        <ProjectCard key={project.id} project={project} index={i + 3} days={days} />
                      ))}
                    </>
                  ) : (
                    paginatedProjects.map((project, i) => (
                      <ProjectCard key={project.id} project={project} index={i} days={days} />
                    ))
                  )}
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
                              {t("projectCol")}
                              {sortBy === "project" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden md:table-cell">{t("categoryCol")}</th>
                          
                          <th className="px-4 py-4 text-left text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden lg:table-cell">{t("languageCol")}</th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("stars")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {t("starsCol")}
                              {sortBy === "stars" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("trend")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {days === 1 ? t("dailyCol") : days === 7 ? t("weeklyCol") : days === 30 ? t("monthlyCol") : t("growthCol")}
                              {sortBy === "trend" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th 
                            className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden md:table-cell cursor-pointer hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                            onClick={() => handleSort("updated")}
                          >
                            <div className="flex items-center justify-end gap-1">
                              {t("updatedCol")}
                              {sortBy === "updated" && <span className="text-xs">{sortOrder === "desc" ? "↓" : "↑"}</span>}
                            </div>
                          </th>
                          
                          <th className="px-4 py-4 text-right text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider hidden sm:table-cell">{t("trendCol")}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedProjects.map((project, i) => (
                          <ProjectTableRow key={project.id} project={project} index={i} days={days} />
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="apple-utility-card divide-y divide-[var(--color-divider-soft)] p-0">
                  <div className="flex items-center gap-3 px-6 py-3 bg-[var(--color-surface-pearl)] text-apple-caption font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider border-b border-[var(--color-divider-soft)]">
                    <span className="w-8 text-right shrink-0">#</span>
                    <span className="flex-1">{t("projectCol")}</span>
                    <div className="flex items-center gap-4 shrink-0">
                      <span className="w-32 text-right">
                        {days === 1 ? t("dailyCol") : days === 7 ? t("weeklyCol") : days === 30 ? t("monthlyCol") : t("growthCol")}
                      </span>
                      <span className="w-24 text-right">{t("starsCol")}</span>
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
                        <span className="w-32 text-right">
                          {getGrowthText(project) ? (
                            <span className="delta-positive text-[11px] font-medium animate-fade-in">
                              {getGrowthText(project)}
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
                  {t("previous")}
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
                  {t("next")}
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
                {t("categoriesWidget")}
              </h2>
              <div className="space-y-2">
                {categories.slice(0, 8).map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/?category=${cat.slug}`}
                    className="flex items-center justify-between rounded-xl px-3.5 py-2.5 transition-all duration-200 hover:bg-[var(--color-divider-soft)] active:scale-[0.98] group min-w-0"
                  >
                    <span className="flex items-center gap-3 min-w-0">
                      <span 
                        className="flex items-center justify-center w-7 h-7 rounded-lg shrink-0" 
                        style={{ backgroundColor: `${cat.color}15`, color: cat.color }}
                      >
                        <CategoryIcon icon={cat.icon} name={cat.name} className="h-4 w-4" />
                      </span>
                      <span className="text-sm font-semibold text-[var(--color-ink)] truncate group-hover:text-[var(--color-action-blue)] transition-colors">
                        {cat.name}
                      </span>
                    </span>
                    <span className="flex items-center gap-1.5 shrink-0 ml-2">
                      <span className="text-xs font-semibold text-[var(--color-ink-muted-80)] tabular-nums bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-2 py-0.5 rounded-full">
                        {cat.projectCount}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5 text-[var(--color-ink-muted-48)] group-hover:text-[var(--color-action-blue)] group-hover:translate-x-0.5 transition-all" />
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending Topics */}
            <div className="apple-utility-card p-6 relative overflow-hidden group/widget">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-500/5 blur-xl transition-all duration-500 group-hover/widget:bg-amber-500/10 pointer-events-none" />
              <h2 className="text-apple-body-strong mb-5 flex items-center gap-2 font-bold text-[var(--color-ink)]">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/10 text-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.1)]">
                  <Zap className="h-4 w-4 animate-pulse" />
                </div>
                {t("hotTopicsWidget")}
              </h2>
              <div className="flex flex-wrap gap-2">
                {(hashtags.length > 0 ? hashtags.slice(0, 20) : ["AI Agent", "MCP", "RAG", "LLM", "Coding Assistant", "Open Source", "Rust", "Agentic", "Multi-modal", "Edge AI"]).map((topic) => {
                  const isActive = selectedTag === topic;
                  return (
                    <Link
                      key={topic}
                      href={isActive ? "/" : `/?tag=${encodeURIComponent(topic)}`}
                      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold border transition-all duration-300 transform hover:scale-[1.03] active:scale-[0.97] cursor-pointer ${
                        isActive
                          ? "bg-gradient-to-r from-blue-600 to-indigo-600 border-blue-600 text-white shadow-md shadow-blue-500/10"
                          : "border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-80)] hover:border-blue-500/40 hover:text-[var(--color-action-blue)] hover:bg-gradient-to-r hover:from-blue-500/[0.02] hover:to-indigo-500/[0.02] hover:shadow-sm"
                      }`}
                    >
                      <span className={`text-[10px] ${isActive ? "text-white/80" : "text-[var(--color-ink-muted-48)] font-bold"}`}>#</span>
                      {topic}
                      {isActive && (
                        <span className="ml-1 text-[9px] hover:bg-white/20 rounded-full h-3.5 w-3.5 flex items-center justify-center transition-colors">✕</span>
                      )}
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Hot Vietnam Projects Widget */}
            <div className="apple-utility-card p-6 relative overflow-hidden group/widget">
              <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-red-500/5 blur-xl transition-all duration-500 group-hover/widget:bg-red-500/10 pointer-events-none" />
              <h2 className="text-apple-body-strong mb-5 flex items-center gap-2 font-bold text-[var(--color-ink)]">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-500/10 text-red-500 shadow-[0_0_12px_rgba(239,68,68,0.1)]">
                  <Flame className="h-4 w-4 animate-pulse" />
                </div>
                Vietnamese Trending
              </h2>
              <div className="space-y-3">
                {hotVNProjects.map((project, idx) => {
                  const gained = project.source === 'github' ? project.starsGained : project.downloadsGained;
                  return (
                    <Link
                      key={project.id}
                      href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-[var(--color-surface-pearl)] transition-colors border border-transparent hover:border-[var(--color-divider-soft)] group min-w-0"
                    >
                      <div className="text-xl font-bold text-[var(--color-ink-muted-48)] w-5 text-right shrink-0">
                        {idx + 1}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-center">
                        <div className="text-sm font-semibold text-[var(--color-ink)] truncate group-hover:text-[var(--color-action-blue)] transition-colors">
                          {project.fullName}
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-ink-muted-80)] font-medium mt-0.5">
                          {gained && gained > 0 && (
                            <span className="flex items-center gap-0.5 text-orange-500 font-semibold shrink-0">
                              <TrendingUp className="h-3 w-3" />
                              +{formatNumber(gained)}
                            </span>
                          )}
                          <span className="truncate">{project.description || "No description"}</span>
                        </div>
                      </div>
                    </Link>
                  );
                })}
                {hotVNProjects.length === 0 && (
                  <div className="text-xs text-[var(--color-ink-muted-80)] text-center py-4">
                    Fetching data...
                  </div>
                )}
              </div>
            </div>

            {/* About Widget */}
            <div className="apple-utility-card hover-spring glow-interactive p-6">
              <h2 className="text-apple-body-strong mb-3 text-[var(--color-ink)]">
                {t("aboutWidgetTitle")}
              </h2>
              <p className="text-apple-caption text-[var(--color-ink-muted-80)] leading-relaxed mb-6">
                {t("aboutWidgetDesc")}
              </p>
              <Link
                href="/submit"
                className="apple-btn-secondary w-full flex justify-center items-center gap-2 bg-[var(--color-canvas)]"
              >
                {t("submitBtn")}
                <ChevronRight className="h-4 w-4" />
              </Link>
            </div>
          </aside>
        </div>
      </section>

      {/* Advanced Filters Drawer (Option A) */}
      <div className={`fixed inset-0 z-50 transition-all duration-305 ${showAdvanced ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"}`}>
        <div 
          className="absolute inset-0 bg-black/30 dark:bg-black/60 backdrop-blur-xs transition-opacity"
          onClick={() => setShowAdvanced(false)}
        />
        <div className={`fixed right-0 top-0 bottom-0 w-full sm:w-[360px] bg-[var(--color-canvas)] border-l border-[var(--color-divider-soft)] shadow-2xl p-6 flex flex-col justify-between transform transition-transform duration-300 ease-out z-50 ${showAdvanced ? "translate-x-0" : "translate-x-full"}`}>
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-[var(--color-divider-soft)] pb-4">
              <h3 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-[var(--color-action-blue)]" />
                {t("advanced")}
              </h3>
              <button 
                onClick={() => setShowAdvanced(false)}
                className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-pearl)] transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="space-y-6">
              {/* Time Period Filter */}
              <div className="flex flex-col gap-2.5">
                <label className="text-[11px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                  {t("timePeriod")} ({t("dayTime").toLowerCase()})
                </label>
                <div className="flex items-center gap-4 bg-[var(--color-surface-pearl)] border border-[var(--color-divider-soft)] rounded-xl p-3.5">
                  <input 
                    type="range" min="1" max="90" value={days}
                    onChange={(e) => handleDaysChange(parseInt(e.target.value))}
                    className="w-full accent-[var(--color-action-blue)] cursor-pointer"
                  />
                  <span className="text-sm font-bold text-[var(--color-ink)] font-mono w-8 text-right tabular-nums">{days}</span>
                </div>
              </div>

              {/* Min Stars Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                  {t("minStars")}
                </label>
                <div className="relative">
                  <input 
                    type="number" min="0" step="100" value={minStars}
                    onChange={(e) => setMinStars(parseInt(e.target.value) || 0)}
                    className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-pearl)] px-4.5 text-sm outline-none focus:border-[var(--color-action-blue)] focus:ring-2 focus:ring-[var(--color-action-blue)]/10 text-[var(--color-ink)] font-semibold transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-[var(--color-ink-muted-48)] font-semibold font-mono">★</span>
                </div>
              </div>

              {/* Min Downloads Filter */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">
                  {t("minDownloads")}
                </label>
                <div className="relative">
                  <input 
                    type="number" min="0" step="1000" value={minDownloads}
                    onChange={(e) => setMinDownloads(parseInt(e.target.value) || 0)}
                    className="w-full h-11 rounded-xl border border-[var(--color-border)] bg-[var(--color-surface-pearl)] px-4.5 text-sm outline-none focus:border-[var(--color-action-blue)] focus:ring-2 focus:ring-[var(--color-action-blue)]/10 text-[var(--color-ink)] font-semibold transition-all"
                  />
                  <span className="absolute right-3.5 top-3.5 text-xs text-[var(--color-ink-muted-48)] font-semibold font-mono">⬇</span>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-[var(--color-divider-soft)] pt-4 flex gap-3">
            <button
              onClick={() => {
                setDays(1);
                setMinStars(100);
                setMinDownloads(1000);
                setShowAdvanced(false);
              }}
              className="flex-1 py-3 text-sm font-semibold rounded-xl bg-[var(--color-surface-pearl)] border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)] text-[var(--color-ink)] transition-colors cursor-pointer"
            >
              Reset
            </button>
            <button
              onClick={() => setShowAdvanced(false)}
              className="flex-1 py-3 text-sm font-semibold rounded-xl bg-[var(--color-action-blue)] text-white hover:bg-[var(--color-accent-hover)] transition-colors cursor-pointer"
            >
              Apply
            </button>
          </div>
        </div>
      </div>
      <ComparisonDrawer />
    </div>
  );
}
