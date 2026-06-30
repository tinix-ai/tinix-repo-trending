"use client";

import React, { useState, useEffect } from "react";
import type { RankedProject, ProjectMention } from "@/types";
import { fetchProjectHistory, fetchProjectMentions, fetchDynamicRankings } from "@/app/actions";
import { Link } from "@/i18n/routing";
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart,
  Bar,
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from "recharts";
import { formatNumber, timeAgo } from "@/lib/utils";
import { 
  Star, 
  GitFork, 
  Download, 
  Shield, 
  Calendar, 
  Trash2, 
  Plus, 
  Search, 
  MessageSquare, 
  Clock, 
  ArrowUpRight, 
  Activity, 
  TrendingUp, 
  Users, 
  ChevronRight
} from "lucide-react";
import { useTranslations } from "next-intl";
import { useComparison } from "@/hooks/use-comparison";

interface CompareDashboardProps {
  initialProjects: RankedProject[];
}

interface HistoryPoint {
  date: string;
  stars: number;
  forks: number;
  downloads: number;
  likes: number;
}

interface ChartPoint {
  date: string;
  [key: string]: string | number;
}

const LINE_COLORS = ["#3B82F6", "#10B981", "#F97316"]; // Electric Blue, Acid Green, Signal Orange

export function CompareDashboard({ initialProjects }: CompareDashboardProps) {
  const t = useTranslations("Compare");
  const tHome = useTranslations("HomePage");
  
  const { selectedProjects, addProject, removeProject, clearProjects } = useComparison();
  const [currentProjects, setCurrentProjects] = useState<RankedProject[]>(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("tinix-comparison-projects");
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) return parsed;
        } catch (e) {
          console.error("Failed to parse saved projects", e);
        }
      }
    }
    return initialProjects;
  });
  
  const [clientNow, setClientNow] = useState<number | null>(null);
  const [histories, setHistories] = useState<Record<string, HistoryPoint[]>>({});
  const [mentions, setMentions] = useState<Record<string, ProjectMention[]>>({});
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [loadingMentions, setLoadingMentions] = useState(true);
  
  // Search state for adding new projects
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<RankedProject[]>([]);
  const [searching, setSearching] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Initialize client timestamp to avoid hydration mismatch and react purity errors
  useEffect(() => {
    const handle = setTimeout(() => {
      setClientNow(Date.now());
    }, 0);
    return () => clearTimeout(handle);
  }, []);

  // Synchronize state with comparison hook (localStorage)
  useEffect(() => {
    const handleCustomChange = () => {
      const saved = localStorage.getItem("tinix-comparison-projects");
      if (saved) {
        try {
          setCurrentProjects(JSON.parse(saved));
        } catch (e) {
          console.error(e);
        }
      } else {
        setCurrentProjects([]);
      }
    };
    window.addEventListener("tinix-comparison-change", handleCustomChange);
    return () => window.removeEventListener("tinix-comparison-change", handleCustomChange);
  }, []);

  // Save query params initial projects to storage if it's empty
  useEffect(() => {
    if (initialProjects.length > 0 && selectedProjects.length === 0) {
      initialProjects.forEach(p => addProject(p));
    }
  }, [initialProjects, selectedProjects, addProject]);

  // Load history snapshots & social mentions
  useEffect(() => {
    if (currentProjects.length === 0) {
      const handle = setTimeout(() => {
        setLoadingHistory(false);
        setLoadingMentions(false);
      }, 0);
      return () => clearTimeout(handle);
    }

    const loadData = async () => {
      setLoadingHistory(true);
      setLoadingMentions(true);
      try {
        // Fetch histories
        const historyData = await Promise.all(
          currentProjects.map(p => fetchProjectHistory(p.id, 30))
        );
        const nextHistories: Record<string, HistoryPoint[]> = {};
        currentProjects.forEach((p, idx) => {
          nextHistories[p.id] = historyData[idx] as unknown as HistoryPoint[];
        });
        setHistories(nextHistories);
        setLoadingHistory(false);

        // Fetch mentions
        const mentionsData = await Promise.all(
          currentProjects.map(p => fetchProjectMentions(p.id))
        );
        const nextMentions: Record<string, ProjectMention[]> = {};
        currentProjects.forEach((p, idx) => {
          nextMentions[p.id] = mentionsData[idx];
        });
        setMentions(nextMentions);
        setLoadingMentions(false);
      } catch (err) {
        console.error("Failed to fetch compare analytics data:", err);
        setLoadingHistory(false);
        setLoadingMentions(false);
      }
    };

    loadData();
  }, [currentProjects]);

  // Search logic
  useEffect(() => {
    if (!searchQuery.trim()) {
      const handle = setTimeout(() => {
        setSearchResults([]);
      }, 0);
      return () => clearTimeout(handle);
    }

    const delayDebounce = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetchDynamicRankings({
          searchQuery: searchQuery,
          limit: 6,
          filterType: "all"
        });
        // Filter out already selected projects
        const filtered = res.projects.filter(
          (p) => !currentProjects.some((cp) => cp.id === p.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error("Search failed:", err);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery, currentProjects]);

  // Merge histories for Cumulative Line Chart
  const getMergedChartData = (): ChartPoint[] => {
    const dateMap: Record<string, ChartPoint> = {};

    currentProjects.forEach((project) => {
      const projectHistory = histories[project.id] || [];
      projectHistory.forEach((point) => {
        const dateStr = point.date;
        if (!dateMap[dateStr]) {
          dateMap[dateStr] = { date: dateStr };
        }
        // Normalize: GitHub shows stars, HuggingFace shows downloads
        dateMap[dateStr][project.fullName] = project.source === "github" ? point.stars : point.downloads;
      });
    });

    return Object.values(dateMap).sort((a, b) => {
      return new Date(a.date).getTime() - new Date(b.date).getTime();
    });
  };

  // Prepare delta data for Bar Chart Comparison
  const getGrowthVelocityData = () => {
    return currentProjects.map((p) => {
      const isGithub = p.source === "github";

      // Delta values derived from trends table
      return {
        name: p.name,
        "Daily Growth": isGithub ? p.starsGained : (p.downloadsGained || 0),
        "Weekly Growth": isGithub ? p.starsGained * 7 : (p.downloadsGained || 0) * 7, // Fallback placeholder logic if trend is missing
        "Monthly Growth": isGithub ? p.starsGained * 30 : (p.downloadsGained || 0) * 30,
        fullName: p.fullName
      };
    });
  };

  const handleAddProjectToSlot = (project: RankedProject) => {
    if (currentProjects.length >= 3) {
      alert(t("limitExceeded"));
      return;
    }
    const success = addProject(project);
    if (success) {
      setActiveSlot(null);
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const handleRemoveProject = (projectId: string) => {
    removeProject(projectId);
    setCurrentProjects(prev => prev.filter(p => p.id !== projectId));
  };

  // Helper calculation for age
  const calculateAge = (dateStr?: string) => {
    if (!dateStr || !clientNow) return "—";
    const created = new Date(dateStr);
    const diffTime = Math.abs(clientNow - created.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 30) return `${diffDays} ngày`;
    const diffMonths = Math.floor(diffDays / 30);
    if (diffMonths < 12) return `${diffMonths} tháng`;
    const diffYears = (diffDays / 365).toFixed(1);
    return `${diffYears} năm`;
  };

  // Determine Leader helper
  const getLeaderId = (metric: "stars" | "downloads" | "mentions" | "contributors") => {
    if (currentProjects.length === 0) return null;
    let maxVal = -1;
    let leaderId = null;

    currentProjects.forEach((p) => {
      let val = 0;
      if (metric === "stars") {
        val = p.stars || 0;
      } else if (metric === "downloads") {
        val = p.downloads || 0;
      } else if (metric === "mentions") {
        val = p.mentionsCount || 0;
      } else if (metric === "contributors") {
        val = p.contributorsCount || 0;
      }

      if (val > maxVal) {
        maxVal = val;
        leaderId = p.id;
      }
    });

    return maxVal > 0 ? leaderId : null;
  };

  const starLeader = getLeaderId("stars");
  const downloadLeader = getLeaderId("downloads");
  const mentionsLeader = getLeaderId("mentions");
  const contributorsLeader = getLeaderId("contributors");

  const chartData = getMergedChartData();
  const velocityData = getGrowthVelocityData();

  return (
    <div className="page-container py-8 max-w-7xl mx-auto space-y-10">
      
      {/* Header Info */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center border-b border-[var(--color-divider-soft)] pb-6 gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--color-ink)] font-mono">
            {t("header")} ({currentProjects.length}/3)
          </h1>
          <p className="text-sm text-[var(--color-ink-muted-80)] mt-1">
            {t("subtitle")}
          </p>
        </div>
        <div className="flex gap-3">
          <Link
            href="/"
            className="px-4 py-2 text-xs font-bold rounded-xl border border-[var(--color-border)] hover:bg-[var(--color-surface-pearl)] text-[var(--color-ink)] transition-all cursor-pointer flex items-center gap-1.5"
          >
            {tHome("backBtn")}
          </Link>
          {currentProjects.length > 0 && (
            <button
              onClick={() => {
                clearProjects();
                setCurrentProjects([]);
              }}
              className="px-4 py-2 text-xs font-bold rounded-xl border border-red-500/25 hover:bg-red-500/5 text-red-500 transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa tất cả so sánh
            </button>
          )}
        </div>
      </div>

      {/* Main Compare Slots Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[0, 1, 2].map((idx) => {
          const project = currentProjects[idx];
          const isSlotActive = activeSlot === idx;

          if (project) {
            return (
              <div 
                key={project.id}
                className="apple-utility-card relative group p-6 flex flex-col justify-between h-[180px] border border-[var(--color-divider-soft)] transition-all hover:border-[var(--color-action-blue)]/50 hover:shadow-lg"
              >
                <div>
                  <div className="flex justify-between items-start gap-2">
                    <span 
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded"
                      style={{ color: LINE_COLORS[idx], backgroundColor: `${LINE_COLORS[idx]}15` }}
                    >
                      Dự án #{idx + 1}
                    </span>
                    <button
                      onClick={() => handleRemoveProject(project.id)}
                      className="text-[var(--color-ink-muted-48)] hover:text-red-500 p-1 rounded-full hover:bg-[var(--color-surface-pearl)] transition-colors cursor-pointer"
                      title={t("remove")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <h3 className="text-base font-bold text-[var(--color-ink)] mt-3 leading-tight truncate">
                    {project.fullName}
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted-80)] line-clamp-2 mt-1 leading-relaxed">
                    {project.description}
                  </p>
                </div>
                <div className="flex items-center justify-between border-t border-[var(--color-divider-soft)] pt-3 mt-4">
                  <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--color-ink-muted-48)]">
                    {project.source} / {project.projectType}
                  </span>
                  <Link 
                    href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                    className="text-[11px] font-bold text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] flex items-center gap-0.5 cursor-pointer"
                  >
                    Chi tiết <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>
              </div>
            );
          }

          return (
            <div 
              key={`empty-${idx}`}
              className={`apple-utility-card relative flex flex-col items-center justify-center h-[180px] border-2 border-dashed transition-all p-6 ${
                isSlotActive 
                  ? "border-[var(--color-action-blue)] bg-[var(--color-action-blue)]/[0.02]" 
                  : "border-[var(--color-border)] hover:border-[var(--color-ink-muted-80)]"
              }`}
            >
              {isSlotActive ? (
                <div className="w-full flex flex-col h-full justify-between">
                  <div className="flex justify-between items-center pb-2 border-b border-[var(--color-divider-soft)]">
                    <span className="text-xs font-bold text-[var(--color-ink)]">{t("selectProject")}</span>
                    <button 
                      onClick={() => {
                        setActiveSlot(null);
                        setSearchQuery("");
                      }}
                      className="text-xs text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]"
                    >
                      Hủy
                    </button>
                  </div>
                  
                  {/* Search input container */}
                  <div className="relative mt-2 flex-1">
                    <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-[var(--color-ink-muted-48)]">
                      <Search className="w-4 h-4" />
                    </div>
                    <input
                      type="text"
                      placeholder={t("searchPlaceholder")}
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-4 py-2 border border-[var(--color-border)] rounded-xl text-xs outline-none bg-[var(--color-canvas)] focus:border-[var(--color-action-blue)] text-[var(--color-ink)]"
                      autoFocus
                    />
                    
                    {/* Search results dropdown popup */}
                    {searchQuery.trim() !== "" && (
                      <div className="absolute left-0 right-0 top-full mt-2 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl shadow-2xl z-50 max-h-[160px] overflow-y-auto">
                        {searching ? (
                          <div className="p-3 text-center text-xs text-[var(--color-ink-muted-48)]">Đang tìm kiếm...</div>
                        ) : searchResults.length === 0 ? (
                          <div className="p-3 text-center text-xs text-[var(--color-ink-muted-48)]">Không tìm thấy dự án nào</div>
                        ) : (
                          searchResults.map((p) => (
                            <button
                              key={p.id}
                              onClick={() => handleAddProjectToSlot(p)}
                              className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-pearl)] text-xs text-[var(--color-ink)] border-b border-[var(--color-divider-soft)] last:border-b-0 flex justify-between items-center transition-colors cursor-pointer"
                            >
                              <span className="font-semibold truncate mr-2">{p.fullName}</span>
                              <span className="text-[9px] uppercase font-bold text-[var(--color-ink-muted-48)] tracking-wider shrink-0">{p.source}</span>
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <button
                  onClick={() => setActiveSlot(idx)}
                  className="flex flex-col items-center gap-2 text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] transition-colors cursor-pointer w-full h-full justify-center"
                >
                  <div className="w-10 h-10 rounded-full border border-[var(--color-border)] flex items-center justify-center bg-[var(--color-surface-pearl)]">
                    <Plus className="w-5 h-5 text-[var(--color-ink-muted-80)] group-hover:text-[var(--color-action-blue)]" />
                  </div>
                  <span className="text-xs font-bold">{t("emptySlot")}</span>
                </button>
              )}
            </div>
          );
        })}
      </div>

      {currentProjects.length === 0 ? (
        <div className="apple-utility-card py-16 text-center text-[var(--color-ink-muted-80)]">
          <Activity className="w-12 h-12 text-[var(--color-border)] mx-auto mb-4" />
          <p className="text-sm font-semibold">Chưa có dự án nào được chọn để so sánh.</p>
          <p className="text-xs text-[var(--color-ink-muted-48)] mt-1">Hãy nhấp vào nút &quot;Thêm dự án&quot; ở trên hoặc quay về trang chủ để chọn dự án.</p>
        </div>
      ) : (
        <>
          {/* Growth Analytics Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* Cumulative growth Recharts Line */}
            <div className="apple-utility-card p-6 border border-[var(--color-divider-soft)]">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="w-4 h-4 text-[var(--color-action-blue)]" />
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-[var(--color-ink-muted-80)] font-mono">
                  {t("growthChart")} (Stars / Lượt tải lũy kế)
                </h3>
              </div>
              <div className="h-[280px] w-full">
                {loadingHistory ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--color-ink-muted-48)]">
                    Đang tải dữ liệu lịch sử...
                  </div>
                ) : chartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--color-ink-muted-48)]">
                    {t("noHistoryData")}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <LineChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" vertical={false} />
                      <XAxis dataKey="date" stroke="var(--color-ink-muted-48)" fontSize={10} tickLine={false} />
                      <YAxis 
                        stroke="var(--color-ink-muted-48)" 
                        fontSize={10} 
                        tickLine={false} 
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--color-bg-secondary)", 
                          borderColor: "var(--color-divider-soft)", 
                          borderRadius: "12px",
                          boxShadow: "var(--shadow-lg)"
                        }}
                        itemStyle={{ color: "var(--color-ink)", fontSize: "11px" }}
                        labelStyle={{ color: "var(--color-ink)", fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      {currentProjects.map((p, idx) => (
                        <Line 
                          key={p.id}
                          type="monotone"
                          dataKey={p.fullName}
                          stroke={LINE_COLORS[idx]}
                          strokeWidth={2.5}
                          dot={false}
                          activeDot={{ r: 5 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Growth velocity Recharts Bar */}
            <div className="apple-utility-card p-6 border border-[var(--color-divider-soft)]">
              <div className="flex items-center gap-2 mb-6">
                <Activity className="w-4 h-4 text-emerald-500" />
                <h3 className="text-xs uppercase font-extrabold tracking-wider text-[var(--color-ink-muted-80)] font-mono">
                  So sánh tốc độ tăng trưởng (Stars / Downloads Delta)
                </h3>
              </div>
              <div className="h-[280px] w-full">
                {loadingHistory ? (
                  <div className="h-full flex items-center justify-center text-xs text-[var(--color-ink-muted-48)]">
                    Đang tải phân tích đà tăng trưởng...
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={velocityData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" vertical={false} />
                      <XAxis dataKey="name" stroke="var(--color-ink-muted-48)" fontSize={10} tickLine={false} />
                      <YAxis 
                        stroke="var(--color-ink-muted-48)" 
                        fontSize={10} 
                        tickLine={false} 
                        tickFormatter={(v) => formatNumber(v)}
                      />
                      <Tooltip 
                        contentStyle={{ 
                          backgroundColor: "var(--color-bg-secondary)", 
                          borderColor: "var(--color-divider-soft)", 
                          borderRadius: "12px",
                          boxShadow: "var(--shadow-lg)"
                        }}
                        itemStyle={{ fontSize: "11px" }}
                        labelStyle={{ color: "var(--color-ink)", fontWeight: "bold", fontSize: "11px", marginBottom: "4px" }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: "11px", paddingTop: "10px" }} />
                      <Bar dataKey="Daily Growth" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Weekly Growth" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="Monthly Growth" fill="#F97316" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </div>

          {/* Structured Detailed Comparison Matrix Table */}
          <div className="apple-utility-card overflow-hidden p-0 border border-[var(--color-divider-soft)] shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-pearl)]">
                    <th className="py-4 px-5 font-extrabold text-[var(--color-ink-muted-80)] uppercase tracking-wider w-1/4 text-[10px] font-mono border-r border-[var(--color-divider-soft)]">
                      Thuộc tính đối chiếu
                    </th>
                    {currentProjects.map((p, idx) => (
                      <th 
                        key={p.id} 
                        className="py-4 px-5 font-bold uppercase tracking-wider text-sm border-r border-[var(--color-divider-soft)] last:border-r-0"
                        style={{ color: LINE_COLORS[idx] }}
                      >
                        {p.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--color-divider-soft)] font-medium text-[var(--color-ink)]">
                  
                  {/* Category Header: OVERVIEW */}
                  <tr className="bg-[var(--color-bg-secondary)] font-extrabold text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]">
                    <td colSpan={currentProjects.length + 1} className="py-2.5 px-5 uppercase">
                      {t("overview")}
                    </td>
                  </tr>
                  
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Tên đầy đủ (Full Name)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 break-all select-all font-semibold border-r border-[var(--color-divider-soft)] last:border-r-0">
                        {p.fullName}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">{t("aiSummary")}</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 text-[var(--color-ink-muted-80)] font-sans leading-relaxed border-r border-[var(--color-divider-soft)] last:border-r-0 text-justify">
                        {p.aiSummary || p.description || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Nền tảng</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 capitalize font-semibold border-r border-[var(--color-divider-soft)] last:border-r-0">
                        {p.source}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Giấy phép (License)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0">
                        {p.license ? (
                          <span className="inline-flex items-center gap-1.5 text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded font-semibold border border-emerald-500/20">
                            <Shield className="w-3 h-3" />
                            {p.license}
                          </span>
                        ) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Ngôn ngữ chính</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-semibold text-[13px]">
                        {p.primaryLanguage || "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Chủ đề (Topics)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0">
                        <div className="flex flex-wrap gap-1">
                          {p.topics && p.topics.slice(0, 5).map(topic => (
                            <span 
                              key={topic}
                              className="text-[10px] font-semibold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-1.5 py-0.5 rounded text-[var(--color-ink-muted-80)]"
                            >
                              #{topic}
                            </span>
                          ))}
                        </div>
                      </td>
                    ))}
                  </tr>

                  {/* Category Header: SCALE & ACTIVITY */}
                  <tr className="bg-[var(--color-bg-secondary)] font-extrabold text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]">
                    <td colSpan={currentProjects.length + 1} className="py-2.5 px-5 uppercase">
                      {t("scaleAndActivity")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Tổng Stars / Likes</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-[13px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          {formatNumber(p.stars || 0)}
                          {p.id === starLeader && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 rounded">
                              {t("leader")}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Lượt tải về (Downloads)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-[13px] font-bold text-cyan-600">
                        {p.source === "huggingface" ? (
                          <div className="flex items-center gap-1.5">
                            <Download className="w-3.5 h-3.5" />
                            {formatNumber(p.downloads || 0)}
                            {p.id === downloadLeader && (
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-cyan-500/10 text-cyan-600 border border-cyan-500/20 rounded">
                                {t("leader")}
                              </span>
                            )}
                          </div>
                        ) : "— (N/A)"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Forks / Copy</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono">
                        {p.source === "github" ? (
                          <div className="flex items-center gap-1.5">
                            <GitFork className="w-3.5 h-3.5 text-zinc-400" />
                            {formatNumber(p.forks || 0)}
                          </div>
                        ) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Số người đóng góp (Contributors)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono font-bold">
                        {p.source === "github" ? (
                          <div className="flex items-center gap-1.5">
                            <Users className="w-3.5 h-3.5 text-blue-500" />
                            {formatNumber(p.contributorsCount || 0)}
                            {p.id === contributorsLeader && (
                              <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-blue-500/10 text-blue-600 border border-blue-500/20 rounded">
                                {t("leader")}
                              </span>
                            )}
                          </div>
                        ) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Số Issues mở (Open Issues)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono">
                        {p.source === "github" ? (
                          <span className={`${(p.openIssues || 0) > 100 ? "text-amber-500" : ""}`}>
                            {formatNumber(p.openIssues || 0)} Issues
                          </span>
                        ) : "—"}
                      </td>
                    ))}
                  </tr>

                  {/* Category Header: GROWTH TRENDS */}
                  <tr className="bg-[var(--color-bg-secondary)] font-extrabold text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]">
                    <td colSpan={currentProjects.length + 1} className="py-2.5 px-5 uppercase">
                      {t("growthTrends")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Tăng trưởng 24h</td>
                    {currentProjects.map((p) => {
                      const isGithub = p.source === "github";
                      const val = isGithub ? p.starsGained : (p.downloadsGained || 0);
                      return (
                        <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono font-bold text-emerald-600 text-[13px]">
                          {val > 0 ? `+${formatNumber(val)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Tăng trưởng 7 ngày (Delta)</td>
                    {currentProjects.map((p) => {
                      const isGithub = p.source === "github";
                      const val = isGithub ? p.starsGained * 7 : (p.downloadsGained || 0) * 7;
                      return (
                        <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-emerald-600">
                          {val > 0 ? `+${formatNumber(val)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Tăng trưởng 30 ngày (Delta)</td>
                    {currentProjects.map((p) => {
                      const isGithub = p.source === "github";
                      const val = isGithub ? p.starsGained * 30 : (p.downloadsGained || 0) * 30;
                      return (
                        <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-emerald-600">
                          {val > 0 ? `+${formatNumber(val)}` : "—"}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Category Header: COMMUNITY HEALTH */}
                  <tr className="bg-[var(--color-bg-secondary)] font-extrabold text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]">
                    <td colSpan={currentProjects.length + 1} className="py-2.5 px-5 uppercase">
                      {t("communityHealth")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">{t("forksStarsRatio")}</td>
                    {currentProjects.map((p) => {
                      if (p.source !== "github") return <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 text-zinc-400">— (N/A)</td>;
                      const ratio = p.stars ? ((p.forks || 0) / p.stars * 100).toFixed(2) : "0.00";
                      return (
                        <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-[13px] font-bold">
                          {ratio}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">{t("issuesStarsRatio")}</td>
                    {currentProjects.map((p) => {
                      if (p.source !== "github") return <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 text-zinc-400">— (N/A)</td>;
                      const ratio = p.stars ? ((p.openIssues || 0) / p.stars * 100).toFixed(2) : "0.00";
                      return (
                        <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono">
                          {ratio}%
                        </td>
                      );
                    })}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">{t("lastUpdated")} (Repo Update)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-zinc-400" />
                        {p.sourceUpdatedAt ? timeAgo(p.sourceUpdatedAt) : "—"}
                      </td>
                    ))}
                  </tr>
                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">{t("age")}</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {calculateAge(p.sourceCreatedAt)}
                      </td>
                    ))}
                  </tr>

                  {/* Category Header: SOCIAL BUZZ */}
                  <tr className="bg-[var(--color-bg-secondary)] font-extrabold text-[10px] font-mono tracking-wider text-[var(--color-ink-muted-48)]">
                    <td colSpan={currentProjects.length + 1} className="py-2.5 px-5 uppercase">
                      {t("socialBuzz")}
                    </td>
                  </tr>

                  <tr>
                    <td className="py-3.5 px-5 text-[var(--color-ink-muted-80)] border-r border-[var(--color-divider-soft)]">Số lượng đề cập (Mentions)</td>
                    {currentProjects.map((p) => (
                      <td key={p.id} className="py-3.5 px-5 border-r border-[var(--color-divider-soft)] last:border-r-0 font-mono text-[13px] font-bold">
                        <div className="flex items-center gap-1.5">
                          <MessageSquare className="w-3.5 h-3.5 text-emerald-500" />
                          {p.mentionsCount || 0}
                          {p.id === mentionsLeader && (
                            <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 rounded">
                              {t("leader")}
                            </span>
                          )}
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Social Mentions Buzz Side-by-Side Feed Columns */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 border-b border-[var(--color-divider-soft)] pb-3">
              <MessageSquare className="w-5 h-5 text-emerald-500" />
              <h2 className="text-base font-bold text-[var(--color-ink)] font-mono uppercase tracking-wider">
                Social Discussions (Hacker News, Reddit & X)
              </h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {currentProjects.map((p, idx) => {
                const projectMentions = mentions[p.id] || [];

                return (
                  <div key={p.id} className="flex flex-col gap-4">
                    {/* Project Header tag for columns */}
                    <div 
                      className="text-xs font-bold px-3 py-2 rounded-xl flex items-center justify-between border select-none"
                      style={{ 
                        color: LINE_COLORS[idx], 
                        borderColor: `${LINE_COLORS[idx]}25`,
                        backgroundColor: `${LINE_COLORS[idx]}05`
                      }}
                    >
                      <span className="truncate max-w-[80%]">{p.fullName}</span>
                      <span className="text-[10px] bg-[var(--color-canvas)] border px-1.5 py-0.5 rounded-full shrink-0 font-mono">
                        {projectMentions.length} posts
                      </span>
                    </div>

                    {/* Mentions list */}
                    <div className="space-y-4 max-h-[480px] overflow-y-auto pr-1">
                      {loadingMentions ? (
                        <div className="text-center py-6 text-xs text-[var(--color-ink-muted-48)] font-mono">
                          Đang tải ý kiến cộng đồng...
                        </div>
                      ) : projectMentions.length === 0 ? (
                        <div className="apple-utility-card py-10 text-center text-[var(--color-ink-muted-48)] italic leading-relaxed text-xs">
                          {t("noSocialMentions")}
                        </div>
                      ) : (
                        projectMentions.map((mention) => (
                          <div 
                            key={mention.id}
                            className="apple-utility-card p-4 border border-[var(--color-divider-soft)] bg-[var(--color-surface-pearl)] flex flex-col justify-between hover:shadow-md transition-shadow relative"
                          >
                            <div>
                              <div className="flex justify-between items-center gap-2 mb-2 text-[10px] font-semibold text-[var(--color-ink-muted-48)] uppercase tracking-wider">
                                <span className="text-[var(--color-action-blue)] font-bold">
                                  u/{mention.author || "anonymous"}
                                </span>
                                <span className="bg-[var(--color-canvas)] px-1.5 py-0.5 rounded border border-[var(--color-border)] shrink-0 font-bold">
                                  {mention.source}
                                </span>
                              </div>
                              <p className="text-xs text-[var(--color-ink)] line-clamp-4 leading-relaxed font-sans text-justify break-words">
                                {mention.content}
                              </p>
                            </div>
                            <div className="flex justify-between items-center border-t border-[var(--color-divider-soft)] pt-2.5 mt-3 text-[10px] text-[var(--color-ink-muted-48)]">
                              <span className="font-mono">
                                {timeAgo(mention.mentionedAt)}
                              </span>
                              <a
                                href={mention.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[var(--color-action-blue)] hover:underline inline-flex items-center gap-0.5 cursor-pointer font-bold"
                              >
                                Xem bài viết <ArrowUpRight className="w-3 h-3" />
                              </a>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
