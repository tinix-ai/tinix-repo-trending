"use client";

import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  Zap,
  ChevronLeft,
  ChevronRight,
  Filter,
} from "lucide-react";
import { fetchRecentJobs, type RecentJob } from "@/app/actions";

type StatusFilter = 'all' | 'active' | 'completed' | 'failed' | 'waiting';
type SourceFilter = 'all' | 'github' | 'huggingface';

function timeAgo(ts: number | null): string {
  if (!ts) return '—';
  const diff = Date.now() - ts;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function formatDuration(start: number | null, end: number | null): string {
  if (!start || !end) return '—';
  const diff = end - start;
  if (diff < 1000) return `${diff}ms`;
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; label: string }> = {
  active: { icon: Zap, color: 'text-emerald-500', bg: 'bg-emerald-500/10', label: 'Active' },
  completed: { icon: CheckCircle2, color: 'text-emerald-400', bg: 'bg-emerald-400/10', label: 'Completed' },
  failed: { icon: XCircle, color: 'text-red-500', bg: 'bg-red-500/10', label: 'Failed' },
  waiting: { icon: Clock, color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Waiting' },
  delayed: { icon: Loader2, color: 'text-amber-500', bg: 'bg-amber-500/10', label: 'Delayed' },
};

export function RecentJobsTable() {
  const [jobs, setJobs] = useState<RecentJob[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('all');
  const [page, setPage] = useState(0);
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const limit = 10;

  const loadJobs = useCallback(async () => {
    setLoading(true);
    const result = await fetchRecentJobs(sourceFilter, statusFilter, page, limit);
    setJobs(result.jobs);
    setTotal(result.total);
    setLoading(false);
  }, [statusFilter, sourceFilter, page]);

  useEffect(() => {
    const timer = setTimeout(() => { loadJobs(); }, 0);
    return () => clearTimeout(timer);
  }, [loadJobs]);

  useEffect(() => {
    const timer = setTimeout(() => { setPage(0); }, 0);
    return () => clearTimeout(timer);
  }, [statusFilter, sourceFilter]);

  const totalPages = Math.ceil(total / limit);

  const statusTabs: { key: StatusFilter; label: string; color?: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active', color: 'text-emerald-500' },
    { key: 'completed', label: 'Completed', color: 'text-emerald-400' },
    { key: 'failed', label: 'Failed', color: 'text-red-500' },
    { key: 'waiting', label: 'Waiting', color: 'text-blue-500' },
  ];

  return (
    <div className="apple-utility-card">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 ${
                statusFilter === tab.key
                  ? 'bg-[var(--color-canvas)] shadow-sm text-[var(--color-ink)]'
                  : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink-muted-80)]'
              }`}
              aria-label={`Filter by ${tab.label}`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-[var(--color-ink-muted-48)]" />
          <select
            value={sourceFilter}
            onChange={e => setSourceFilter(e.target.value as SourceFilter)}
            className="bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-blue)]"
            aria-label="Filter by source"
          >
            <option value="all">All Sources</option>
            <option value="github">GitHub</option>
            <option value="huggingface">HuggingFace</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider-soft)]">
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Status</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Job</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Data</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium hidden sm:table-cell">Duration</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium text-right">Time</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--color-ink-muted-48)]" />
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-sm text-[var(--color-ink-muted-48)]">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => {
                const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.waiting;
                const StatusIcon = config.icon;
                const isExpanded = expandedJob === `${job.id}-${i}`;

                return (
                  <tr
                    key={`${job.id}-${i}`}
                    onClick={() => setExpandedJob(isExpanded ? null : `${job.id}-${i}`)}
                    className="border-b border-[var(--color-divider-soft)] last:border-0 cursor-pointer hover:bg-[var(--color-canvas-parchment)] transition-colors"
                  >
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium ${config.bg} ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs font-mono text-[var(--color-ink)]">{job.name}</div>
                      <div className="text-[10px] text-[var(--color-ink-muted-48)]">ID: {job.id}</div>
                    </td>
                    <td className="py-3 px-3">
                      <div className="text-xs text-[var(--color-ink)] font-medium truncate max-w-[200px]">{job.data}</div>
                      {isExpanded && job.failedReason && (
                        <div className="mt-2 p-2 rounded-lg bg-red-500/5 border border-red-500/10 text-[11px] text-red-500 max-w-[300px] break-words">
                          {job.failedReason}
                        </div>
                      )}
                    </td>
                    <td className="py-3 px-3 hidden sm:table-cell">
                      <span className="text-xs text-[var(--color-ink-muted-80)] tabular-nums">
                        {formatDuration(job.processedOn, job.finishedOn)}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="text-xs text-[var(--color-ink-muted-48)] tabular-nums">
                        {timeAgo(job.finishedOn || job.timestamp)}
                      </span>
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
        <div className="flex items-center justify-between pt-4 mt-4 border-t border-[var(--color-divider-soft)]">
          <span className="text-xs text-[var(--color-ink-muted-48)]">
            Showing {page * limit + 1}–{Math.min((page + 1) * limit, total)} of {total}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded-lg hover:bg-[var(--color-canvas-parchment)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="w-4 h-4 text-[var(--color-ink)]" />
            </button>
            <span className="text-xs text-[var(--color-ink)] tabular-nums px-2">
              {page + 1} / {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="p-1.5 rounded-lg hover:bg-[var(--color-canvas-parchment)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="w-4 h-4 text-[var(--color-ink)]" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
