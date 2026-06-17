"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw,
  Pause,
  Play,
  Trash2,
  RotateCcw,
  Zap,
  Clock,
  AlertTriangle,
  CheckCircle2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import {
  fetchDetailedQueueStats,
  pauseQueue,
  resumeQueue,
  drainQueue,
  retryFailedJobs,
  triggerCrawlerSync,
  triggerJobNow,
} from "@/app/actions";

interface QueueDetails {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
  total: number;
  discovery: number;
  update: number;
}

interface DetailedStats {
  github: QueueDetails;
  huggingface: QueueDetails;
  scheduler: QueueDetails;
  activeSchedulerJobs?: string[];
}

type ActionType = 'pause' | 'resume' | 'drain' | 'retry' | 'sync';
type SourceType = 'github' | 'huggingface' | 'scheduler';

export function QueueControlPanel() {
  const t = useTranslations("Admin");
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const data = await fetchDetailedQueueStats();
      setStats(data);
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => { loadStats(); }, 0);
    return () => clearTimeout(timer);
  }, [loadStats]);

  useEffect(() => {
    if (!autoRefresh) return;
    const initTimer = setTimeout(() => { setCountdown(5); }, 0);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setTimeout(() => { loadStats(); }, 0);
          return 5;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { clearTimeout(initTimer); clearInterval(interval); };
  }, [autoRefresh, loadStats]);

  const handleAction = async (action: ActionType, source: SourceType) => {
    const key = `${action}-${source}`;
    setLoadingActions(prev => new Set(prev).add(key));

    const actionPromise = async () => {
      let result;
      switch (action) {
        case 'pause': result = await pauseQueue(source); break;
        case 'resume': result = await resumeQueue(source); break;
        case 'drain': result = await drainQueue(source); break;
        case 'retry': result = await retryFailedJobs(source); break;
        case 'sync': result = await triggerCrawlerSync(source as 'github' | 'huggingface'); break;
      }
      if (!result.success) throw new Error(result.message);
      await loadStats();
      return result.message;
    };

    toast.promise(actionPromise(), {
      loading: `Executing ${action}...`,
      success: (msg) => msg || `Successfully executed ${action}`,
      error: (err) => err.message || `Failed to execute ${action}`,
      finally: () => {
        setLoadingActions(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    });
  };

  const handleTriggerJob = async (name: string) => {
    const key = `trigger-${name}`;
    setLoadingActions(prev => new Set(prev).add(key));

    const actionPromise = async () => {
      const result = await triggerJobNow(name);
      if (!result.success) throw new Error(result.message);
      await loadStats();
      return t("jobTriggered", { name });
    };

    toast.promise(actionPromise(), {
      loading: t("triggeringJob", { name }),
      success: (msg) => msg,
      error: (err) => err.message || t("triggerJobFailed", { name }),
      finally: () => {
        setLoadingActions(prev => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      }
    });
  };

  const isLoading = (action: ActionType, source: SourceType) =>
    loadingActions.has(`${action}-${source}`);

  const renderQueueCard = (source: SourceType, label: string, q: QueueDetails) => {
    const isActive = q.active > 0 || q.waiting > 0;
    const statusColor = q.isPaused
      ? 'bg-amber-500/10 text-amber-500'
      : isActive
        ? 'bg-emerald-500/10 text-emerald-500'
        : 'bg-[var(--color-ink-muted-48)]/10 text-[var(--color-ink-muted-48)]';

    const statusLabel = q.isPaused ? 'Paused' : isActive ? 'Processing' : 'Idle';
    const statusDot = q.isPaused
      ? 'bg-amber-500'
      : isActive
        ? 'bg-emerald-500 animate-pulse'
        : 'bg-[var(--color-ink-muted-48)]';

    return (
      <div key={source} className="apple-utility-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${statusDot}`} />
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">{label}</h3>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-1.5 mb-4">
          {[
            { label: 'Active', value: q.active, icon: Zap, color: 'text-emerald-500' },
            { label: 'Waiting', value: q.waiting, icon: Clock, color: 'text-blue-500' },
            { label: 'Delayed', value: q.delayed, icon: Loader2, color: 'text-amber-500' },
            { label: 'Completed', value: q.completed, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Failed', value: q.failed, icon: AlertTriangle, color: 'text-red-500' },
          ].map(stat => (
            <div key={stat.label} className="text-center p-2 rounded-lg bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
              <stat.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${stat.color}`} />
              <div className="text-sm font-bold text-[var(--color-ink)] tabular-nums">{stat.value.toLocaleString()}</div>
              <div className="text-[9px] text-[var(--color-ink-muted-48)] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Job Type Breakdown (Tìm mới & Cập nhật hàng ngày) */}
        {q.discovery !== undefined && q.update !== undefined && (
          <div className="mb-4 p-3 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] space-y-2">
            <div className="flex justify-between items-center text-[11px]">
              <span className="font-semibold text-[var(--color-ink-muted-80)]">{t("queueBreakdown")}</span>
              <span className="text-[var(--color-ink-muted-48)] tabular-nums">
                {t("totalJobs", { count: (q.discovery + q.update) })}
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-divider-soft)]">
                <div className="text-[9px] uppercase tracking-wider text-blue-500 font-bold mb-0.5">{t("discoveryJobs")}</div>
                <div className="text-sm font-bold text-[var(--color-ink)] tabular-nums">{q.discovery.toLocaleString()}</div>
                <div className="text-[9px] text-[var(--color-ink-muted-48)] mt-0.5">{t("discoveryDesc")}</div>
              </div>
              <div className="p-2.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-divider-soft)]">
                <div className="text-[9px] uppercase tracking-wider text-amber-500 font-bold mb-0.5">{t("updateJobs")}</div>
                <div className="text-sm font-bold text-[var(--color-ink)] tabular-nums">{q.update.toLocaleString()}</div>
                <div className="text-[9px] text-[var(--color-ink-muted-48)] mt-0.5">{t("updateDesc")}</div>
              </div>
            </div>

            {/* Split Progress Bar */}
            {q.discovery + q.update > 0 && (
              <div className="w-full h-1.5 bg-[var(--color-canvas)] rounded-full overflow-hidden flex border border-[var(--color-divider-soft)]">
                <div 
                  className="h-full bg-blue-500 transition-all duration-500" 
                  style={{ width: `${(q.discovery / (q.discovery + q.update)) * 100}%` }}
                  title={`${t("discoveryJobs")}: ${((q.discovery / (q.discovery + q.update)) * 100).toFixed(0)}%`}
                />
                <div 
                  className="h-full bg-amber-500 transition-all duration-500" 
                  style={{ width: `${(q.update / (q.discovery + q.update)) * 100}%` }}
                  title={`${t("updateJobs")}: ${((q.update / (q.discovery + q.update)) * 100).toFixed(0)}%`}
                />
              </div>
            )}
          </div>
        )}

        {/* Total processed */}
        <div className="flex items-center justify-between text-[11px] text-[var(--color-ink-muted-80)] mb-3 px-1">
          <span>Total Processed: <strong className="text-[var(--color-ink)]">{q.total.toLocaleString()}</strong></span>
          <span>Success Rate: <strong className="text-[var(--color-ink)]">
            {q.total > 0 ? `${((q.completed / q.total) * 100).toFixed(1)}%` : 'N/A'}
          </strong></span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-[var(--color-divider-soft)]">
          {q.isPaused ? (
            <ActionButton
              icon={Play}
              label="Resume"
              onClick={() => handleAction('resume', source)}
              loading={isLoading('resume', source)}
              variant="success"
            />
          ) : (
            <ActionButton
              icon={Pause}
              label="Pause"
              onClick={() => handleAction('pause', source)}
              loading={isLoading('pause', source)}
              variant="warning"
            />
          )}
          <ActionButton
            icon={Trash2}
            label="Drain"
            onClick={() => handleAction('drain', source)}
            loading={isLoading('drain', source)}
            variant="danger"
            disabled={q.waiting === 0}
          />
          <ActionButton
            icon={RotateCcw}
            label="Retry Failed"
            onClick={() => handleAction('retry', source)}
            loading={isLoading('retry', source)}
            variant="default"
            disabled={q.failed === 0}
          />
          {source !== 'scheduler' ? (
            <ActionButton
              icon={RefreshCw}
              label="Run Sync"
              onClick={() => handleAction('sync', source)}
              loading={isLoading('sync', source)}
              variant="primary"
            />
          ) : (
            <>
              <ActionButton
                icon={Play}
                label="Run Discovery"
                onClick={() => handleTriggerJob('daily-discovery')}
                loading={loadingActions.has('trigger-daily-discovery')}
                variant="primary"
              />
              <ActionButton
                icon={Play}
                label="Run Update"
                onClick={() => handleTriggerJob('daily-update')}
                loading={loadingActions.has('trigger-daily-update')}
                variant="primary"
              />
            </>
          )}
        </div>
      </div>
    );
  };

  const totalPending = stats 
    ? (stats.github.waiting + stats.github.active + stats.huggingface.waiting + stats.huggingface.active)
    : 0;
  const hasActiveScheduler = !!(stats?.activeSchedulerJobs && stats.activeSchedulerJobs.length > 0);

  return (
    <div className="space-y-4">
      {/* Auto-refresh header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(prev => !prev)}
            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ${autoRefresh ? 'bg-emerald-500' : 'bg-[var(--color-ink-muted-48)]/30'}`}
            aria-label="Toggle auto-refresh"
          >
            <span className={`inline-block h-4 w-4 rounded-full bg-white transition-transform duration-200 ${autoRefresh ? 'translate-x-6' : 'translate-x-1'}`} />
          </button>
          <span className="text-apple-caption text-[var(--color-ink-muted-80)]">
            Auto-refresh {autoRefresh ? `(${countdown}s)` : '(off)'}
          </span>
        </div>
        <button
          onClick={loadStats}
          disabled={isRefreshing}
          className="apple-btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1 disabled:opacity-50"
          aria-label="Refresh queue stats"
        >
          <RefreshCw className={`w-3 h-3 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
        </button>
      </div>

      {/* Active System Tasks & Crawlers Banner */}
      {stats && (hasActiveScheduler || totalPending > 0) && (
        <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex flex-col gap-3">
          {hasActiveScheduler && (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <div className="text-[11px] font-semibold">
                {t("runningSchedulerJobs", {
                  jobs: stats.activeSchedulerJobs!.map(name => {
                    if (name === 'daily-discovery') return 'Daily Discovery (scanning GitHub and HuggingFace for trending projects)';
                    if (name === 'daily-update') return 'Daily Update (generating metrics update queue)';
                    return name;
                  }).join(', ')
                })}
              </div>
            </div>
          )}
          {totalPending > 0 && (
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div className="text-[11px] font-medium">
                {t("activeCrawlers", { count: totalPending })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue cards */}
      {stats ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          {renderQueueCard('github', 'GitHub Crawler', stats.github)}
          {renderQueueCard('huggingface', 'HuggingFace Crawler', stats.huggingface)}
          {renderQueueCard('scheduler', 'System Scheduler', stats.scheduler)}
        </div>
      ) : (
        <div className="apple-utility-card flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink-muted-48)]" />
          <span className="ml-2 text-[var(--color-ink-muted-48)]">Loading queue stats...</span>
        </div>
      )}

      {/* Toasts have been replaced by sonner Toaster in the main layout */}
    </div>
  );
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  loading,
  variant,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  loading: boolean;
  variant: 'default' | 'primary' | 'success' | 'warning' | 'danger';
  disabled?: boolean;
}) {
  const variantStyles: Record<string, string> = {
    default: 'border-[var(--color-hairline)] text-[var(--color-ink)] hover:bg-[var(--color-canvas-parchment)]',
    primary: 'border-[var(--color-action-blue)]/30 text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/5',
    success: 'border-emerald-500/30 text-emerald-600 hover:bg-emerald-500/5',
    warning: 'border-amber-500/30 text-amber-600 hover:bg-amber-500/5',
    danger: 'border-red-500/30 text-red-600 hover:bg-red-500/5',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]}`}
      aria-label={label}
    >
      {loading ? (
        <Loader2 className="w-3 h-3 animate-spin" />
      ) : (
        <Icon className="w-3 h-3" />
      )}
      {label}
    </button>
  );
}
