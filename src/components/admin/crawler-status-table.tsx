"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Search,
  Calendar,
  RefreshCw,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Database,
  GitBranch,
} from "lucide-react";
import { fetchProjectsCrawlStatus, forceRecrawlProject, type ProjectCrawlStatus } from "@/app/actions";

export function CrawlerStatusTable() {
  const [query, setQuery] = useState("");
  const [projects, setProjects] = useState<ProjectCrawlStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [actionLoading, setActionLoading] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const limit = 10;

  const loadProjects = useCallback(async () => {
    setLoading(true);
    const result = await fetchProjectsCrawlStatus(query, page, limit);
    setProjects(result.projects);
    setTotal(result.total);
    setLoading(false);
  }, [query, page]);

  useEffect(() => {
    const timer = setTimeout(() => { loadProjects(); }, 0);
    return () => clearTimeout(timer);
  }, [loadProjects]);

  // Reset page to 0 when search query changes
  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); }, 0);
    return () => clearTimeout(timer);
  }, [query]);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 3000);
  };

  const handleForceUpdate = async (projectId: string, fullName: string) => {
    setActionLoading(prev => {
      const next = new Set(prev);
      next.add(projectId);
      return next;
    });

    try {
      const result = await forceRecrawlProject(projectId);
      if (result.success) {
        showToast(result.message, "success");
        await loadProjects();
      } else {
        showToast(result.message || "Failed to trigger force update", "error");
      }
    } catch {
      showToast("Error executing force update", "error");
    } finally {
      setActionLoading(prev => {
        const next = new Set(prev);
        next.delete(projectId);
        return next;
      });
    }
  };

  const totalPages = Math.ceil(total / limit);

  const formatDate = (date: Date | null) => {
    if (!date) return "Never";
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toLocaleString();
  };

  return (
    <div className="apple-utility-card space-y-4">
      {/* Search & Actions Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[var(--color-ink-muted-48)]" />
          <input
            type="text"
            placeholder="Search projects by name, slug or full name..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] rounded-xl text-sm text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-blue)]"
          />
        </div>
        <button
          onClick={loadProjects}
          className="apple-btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh List
        </button>
      </div>

      {/* Table Container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider-soft)]">
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Project</th>
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Source</th>
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Interval</th>
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Last Crawled</th>
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Next Crawl</th>
              <th className="py-3 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-[var(--color-ink-muted-48)]" />
                </td>
              </tr>
            ) : projects.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-[var(--color-ink-muted-48)]">
                  No projects found.
                </td>
              </tr>
            ) : (
              projects.map((project) => {
                const isGH = project.source === "github";
                const badgeColor = isGH
                  ? "bg-blue-500/10 text-blue-600"
                  : "bg-amber-500/10 text-amber-600";
                
                const typeLabel = project.projectType === "repository" ? "Repo" : project.projectType;

                return (
                  <tr
                    key={project.id}
                    className="border-b border-[var(--color-divider-soft)] last:border-0 hover:bg-[var(--color-canvas-parchment)] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <div className="text-xs font-semibold text-[var(--color-ink)] truncate max-w-[220px]">
                        {project.fullName}
                      </div>
                      <div className="text-[10px] text-[var(--color-ink-muted-48)] mt-0.5 font-mono">
                        {project.id}
                      </div>
                    </td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium capitalize ${badgeColor}`}>
                        {isGH ? (
                          <GitBranch className="w-2.5 h-2.5" />
                        ) : (
                          <Database className="w-2.5 h-2.5" />
                        )}
                        {project.source} ({typeLabel})
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs font-medium text-[var(--color-ink)]">
                        {project.crawlInterval} {project.crawlInterval === 1 ? "day" : "days"}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <span className="text-xs text-[var(--color-ink-muted-80)]">
                        {formatDate(project.lastCrawledAt)}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-[var(--color-ink-muted-48)]" />
                        <span className="text-xs text-[var(--color-ink-muted-80)]">
                          {formatDate(project.nextCrawlAt)}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => handleForceUpdate(project.id, project.fullName)}
                        disabled={actionLoading.has(project.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 border border-[var(--color-action-blue)]/30 text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/5 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg text-xs font-medium transition-all duration-200"
                      >
                        {actionLoading.has(project.id) ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5" />
                        )}
                        Force Update
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 border-t border-[var(--color-divider-soft)]">
          <span className="text-xs text-[var(--color-ink-muted-48)]">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-[var(--color-canvas-parchment)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--color-ink)]" />
            </button>
            <span className="text-xs text-[var(--color-ink)] px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-[var(--color-canvas-parchment)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight className="w-4 h-4 text-[var(--color-ink)]" />
            </button>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50">
          <div
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-in-right ${
              toast.type === "success" ? "bg-emerald-500 text-white" : "bg-red-500 text-white"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}
