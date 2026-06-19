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
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import { fetchRecentJobs, retryJob, removeJob, type RecentJob } from "@/app/actions";
import { toast } from "sonner";

type StatusFilter = 'all' | 'active' | 'completed' | 'failed' | 'waiting';
type SourceFilter = 'all' | 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler';

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
  const [selectedJob, setSelectedJob] = useState<RecentJob | null>(null);
  const [jobActionLoading, setJobActionLoading] = useState<string | null>(null);
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

  const handleRetryJob = async (e: React.MouseEvent, job: RecentJob) => {
    e.stopPropagation();
    const actionKey = `retry-${job.id}`;
    setJobActionLoading(actionKey);
    try {
      const res = await retryJob(job.queueName, job.id);
      if (res.success) {
        toast.success(res.message);
        await loadJobs();
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg);
    } finally {
      setJobActionLoading(null);
    }
  };

  const handleRemoveJob = async (e: React.MouseEvent, job: RecentJob) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to remove this job from the queue?")) return;
    const actionKey = `remove-${job.id}`;
    setJobActionLoading(actionKey);
    try {
      const res = await removeJob(job.queueName, job.id);
      if (res.success) {
        toast.success(res.message);
        await loadJobs();
        if (selectedJob?.id === job.id) {
          setSelectedJob(null);
        }
      } else {
        toast.error(res.message);
      }
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : String(err);
      toast.error(errMsg);
    } finally {
      setJobActionLoading(null);
    }
  };

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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
          {statusTabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all duration-200 ${
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
            className="bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] rounded-md px-2 py-1 text-[11px] text-[var(--color-ink)] focus:outline-none focus:ring-1 focus:ring-[var(--color-action-blue)]"
            aria-label="Filter by source"
          >
            <option value="all">All Sources</option>
            <option value="github">GitHub Crawler</option>
            <option value="huggingface">HF Crawler</option>
            <option value="github-updater">GH Updater</option>
            <option value="hf-updater">HF Updater</option>
            <option value="scheduler">Scheduler</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider-soft)]">
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Status</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Job</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">Data</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium hidden sm:table-cell">Duration</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium text-right">Time</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="py-12 text-center">
                  <Loader2 className="w-5 h-5 animate-spin mx-auto text-[var(--color-ink-muted-48)]" />
                </td>
              </tr>
            ) : jobs.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-sm text-[var(--color-ink-muted-48)]">
                  No jobs found
                </td>
              </tr>
            ) : (
              jobs.map((job, i) => {
                const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.waiting;
                const StatusIcon = config.icon;

                return (
                  <tr
                    key={`${job.id}-${i}`}
                    onClick={() => setSelectedJob(job)}
                    className="border-b border-[var(--color-divider-soft)] last:border-0 cursor-pointer hover:bg-[var(--color-canvas-parchment)] transition-colors"
                  >
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${config.bg} ${config.color}`}>
                        <StatusIcon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-[11px] font-semibold font-mono text-[var(--color-ink)]">{job.name}</div>
                      <div className="text-[9px] text-[var(--color-ink-muted-48)]">ID: {job.id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="text-[11px] text-[var(--color-ink)] font-medium truncate max-w-[200px]">{job.data}</div>
                    </td>
                    <td className="py-2.5 px-3 hidden sm:table-cell">
                      <span className="text-[11px] text-[var(--color-ink-muted-80)] tabular-nums">
                        {formatDuration(job.processedOn, job.finishedOn)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className="text-[11px] text-[var(--color-ink-muted-48)] tabular-nums">
                        {timeAgo(job.finishedOn || job.timestamp)}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {job.status === 'failed' && (
                          <button
                            onClick={(e) => handleRetryJob(e, job)}
                            disabled={jobActionLoading === `retry-${job.id}`}
                            className="p-1 rounded-md border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500/5 disabled:opacity-40 transition-colors"
                            title="Retry Job"
                          >
                            {jobActionLoading === `retry-${job.id}` ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <RotateCcw className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                        <button
                          onClick={(e) => handleRemoveJob(e, job)}
                          disabled={jobActionLoading === `remove-${job.id}`}
                          className="p-1 rounded-md border border-red-500/30 text-red-500 hover:bg-red-500/5 disabled:opacity-40 transition-colors"
                          title="Remove Job"
                        >
                          {jobActionLoading === `remove-${job.id}` ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
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

      {/* Job Details Slide-out Drawer */}
      {selectedJob && (
        <>
          <div 
            className="fixed inset-0 bg-black/40 backdrop-blur-xs z-50 transition-opacity duration-300"
            onClick={() => setSelectedJob(null)}
          />
          <div className="fixed top-0 right-0 h-full w-full max-w-lg bg-[var(--color-canvas)] border-l border-[var(--color-divider-soft)] shadow-2xl z-50 transform transition-transform duration-300 overflow-y-auto translate-x-0">
            <div className="p-6 space-y-6">
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-[var(--color-divider-soft)]">
                <div>
                  <h3 className="text-apple-headline text-[var(--color-ink)] font-semibold">{selectedJob.name}</h3>
                  <p className="text-xs text-[var(--color-ink-muted-48)] mt-0.5 font-mono">ID: {selectedJob.id}</p>
                </div>
                <button 
                  onClick={() => setSelectedJob(null)}
                  className="p-1.5 rounded-lg hover:bg-[var(--color-canvas-parchment)] text-[var(--color-ink-muted-48)] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Status & Queue Details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-3.5 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
                  <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider block font-semibold">Status</span>
                  <span className={`inline-flex items-center gap-1.5 mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_CONFIG[selectedJob.status]?.bg || STATUS_CONFIG.waiting.bg} ${STATUS_CONFIG[selectedJob.status]?.color || STATUS_CONFIG.waiting.color}`}>
                    {selectedJob.status}
                  </span>
                </div>
                <div className="p-3.5 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
                  <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider block font-semibold">Queue Source</span>
                  <span className="text-sm font-semibold text-[var(--color-ink)] mt-2 block capitalize">{selectedJob.queueName}</span>
                </div>
              </div>

              {/* Time logs */}
              <div className="space-y-3 p-4 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
                <h4 className="text-xs font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">Time Logs</h4>
                <div className="space-y-2 text-xs text-[var(--color-ink)]">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-ink-muted-48)]">Queued</span>
                    <span className="font-mono">{new Date(selectedJob.timestamp).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-ink-muted-48)]">Started</span>
                    <span className="font-mono">{selectedJob.processedOn ? new Date(selectedJob.processedOn).toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-ink-muted-48)]">Finished</span>
                    <span className="font-mono">{selectedJob.finishedOn ? new Date(selectedJob.finishedOn).toLocaleString() : '—'}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-[var(--color-divider-soft)]">
                    <span className="font-semibold">Duration</span>
                    <span className="font-mono font-semibold">{formatDuration(selectedJob.processedOn, selectedJob.finishedOn)}</span>
                  </div>
                </div>
              </div>

              {/* Parameters (Payload) */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider">Job Parameters (Data)</h4>
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] font-mono text-xs overflow-x-auto text-[var(--color-ink)]">
                  <pre>{JSON.stringify(selectedJob.rawData, null, 2)}</pre>
                </div>
              </div>

              {/* Fail logs / stacktrace */}
              {selectedJob.status === 'failed' && (
                <div className="space-y-3">
                  <h4 className="text-xs font-bold text-red-500 uppercase tracking-wider">Failure Reason & Logs</h4>
                  <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10 text-xs text-red-500 break-words space-y-3">
                    <div className="font-semibold">{selectedJob.failedReason}</div>
                    {selectedJob.stacktrace && selectedJob.stacktrace.length > 0 && (
                      <div className="font-mono whitespace-pre overflow-x-auto p-3 rounded bg-red-500/10 max-h-60 overflow-y-auto">
                        {selectedJob.stacktrace.join('\n')}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Actions inside drawer */}
              <div className="flex gap-3 pt-6 border-t border-[var(--color-divider-soft)]">
                {selectedJob.status === 'failed' && (
                  <button
                    onClick={(e) => handleRetryJob(e, selectedJob)}
                    disabled={jobActionLoading === `retry-${selectedJob.id}`}
                    className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {jobActionLoading === `retry-${selectedJob.id}` ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RotateCcw className="w-4 h-4" />
                    )}
                    Retry Job
                  </button>
                )}
                <button
                  onClick={(e) => handleRemoveJob(e, selectedJob)}
                  disabled={jobActionLoading === `remove-${selectedJob.id}`}
                  className="flex-1 py-2 px-4 border border-red-500/30 text-red-500 hover:bg-red-500/5 disabled:opacity-50 rounded-xl text-xs font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {jobActionLoading === `remove-${selectedJob.id}` ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                  Remove Job
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
