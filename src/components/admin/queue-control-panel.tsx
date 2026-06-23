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
  Loader2,
} from "lucide-react";

import { toast } from "sonner";
import { useTranslations, useLocale } from "next-intl";
import {
  fetchDetailedQueueStats,
  pauseQueue,
  resumeQueue,
  drainQueue,
  retryFailedJobs,
  triggerCrawlerSync,
  triggerJobNow,
  fetchGithubTokensHealth,
  fetchHuggingFaceTokenHealth,
} from "@/app/actions";


interface HFTokenHealthInfo {
  remaining: number;
  limit: number;
  resetTime: number;
  timestamp: number;
  status: 'active' | 'exhausted';
}

interface TokenHealthInfo {
  index: number;
  maskedToken: string;
  status: 'active' | 'exhausted' | 'invalid';
  coreLimit: number;
  coreRemaining: number;
  coreResetTime: number;
  searchLimit: number;
  searchRemaining: number;
  searchResetTime: number;
  searchResetTime_2?: number; // fallback type helper
}


interface QueueDetails {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  currentFailed: number;
  delayed: number;
  isPaused: boolean;
  total: number;
  discovery: number;
  update: number;
  isSyncRunning?: boolean;
}

interface DetailedStats {
  github: QueueDetails;
  huggingface: QueueDetails;
  githubUpdater: QueueDetails;
  hfUpdater: QueueDetails;
  social: QueueDetails;
  scheduler: QueueDetails;
  activeSchedulerJobs?: string[];
}

type ActionType = 'pause' | 'resume' | 'drain' | 'retry' | 'sync';
type SourceType = 'github' | 'huggingface' | 'github-updater' | 'hf-updater' | 'scheduler' | 'social';

export function QueueControlPanel() {
  const t = useTranslations("Admin");
  const locale = useLocale();

  const discoveryGroupText = locale === 'vi'
    ? 'Trình thu thập tìm mới (Discovery Crawlers)'
    : 'Discovery Crawlers';
    
  const updaterGroupText = locale === 'vi'
    ? 'Trình cập nhật & Bộ lập lịch (Metrics Updaters & Scheduler)'
    : 'Metrics Updaters & Scheduler';
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(15);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [tokensHealth, setTokensHealth] = useState<TokenHealthInfo[] | null>(null);
  const [hfTokenHealth, setHfTokenHealth] = useState<HFTokenHealthInfo | null>(null);
  const [hfResetSeconds, setHfResetSeconds] = useState<number>(0);



  const isSchedulerJobActive = (name: string) => {
    return !!(stats?.activeSchedulerJobs && stats.activeSchedulerJobs.includes(name));
  };

  const totalUpdateJobs = stats 
    ? (stats.github.update || 0) + (stats.huggingface.update || 0) + 
      (stats.githubUpdater.waiting || 0) + (stats.githubUpdater.active || 0) +
      (stats.hfUpdater.waiting || 0) + (stats.hfUpdater.active || 0) +
      (stats.social?.waiting || 0) + (stats.social?.active || 0)
    : 0;

  const totalDiscoveryJobs = stats 
    ? (stats.github.discovery || 0) + (stats.huggingface.discovery || 0)
    : 0;

  // We check if the scheduler job is actively enqueuing
  const isUpdateEnqueuing = isSchedulerJobActive('daily-update');
  const isDiscoveryEnqueuing = isSchedulerJobActive('daily-discovery');
  const isSocialEnqueuing = isSchedulerJobActive('social-mentions');

  const isQueueActionLoading = (source: SourceType) => {
    return Array.from(loadingActions).some(key => {
      return key.endsWith(`-${source}`) || 
             (source === 'scheduler' && (key === 'trigger-daily-discovery' || key === 'trigger-daily-update' || key === 'trigger-social-mentions'));
    });
  };

  const loadStats = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [statsData, tokensData, hfTokenData] = await Promise.all([
        fetchDetailedQueueStats(),
        fetchGithubTokensHealth(),
        fetchHuggingFaceTokenHealth(),
      ]);
      setStats(statsData);
      setTokensHealth(tokensData);
      setHfTokenHealth(hfTokenData);
    } catch (err) {
      console.error("Failed to load admin stats:", err);
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
    const initTimer = setTimeout(() => { setCountdown(15); }, 0);

    const interval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setTimeout(() => { loadStats(); }, 0);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { clearTimeout(initTimer); clearInterval(interval); };
  }, [autoRefresh, loadStats]);

  useEffect(() => {
    if (!hfTokenHealth || hfTokenHealth.status !== 'exhausted') return;
    const updateTimer = () => {
      const diff = Math.max(0, Math.ceil((hfTokenHealth.resetTime - Date.now()) / 1000));
      setHfResetSeconds(diff);
    };
    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [hfTokenHealth]);


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
    const isAnyActionLoading = isQueueActionLoading(source);
    const isActive = q.active > 0 || q.waiting > 0;
    const isPaused = q.isPaused;

    const statusColor = isPaused
      ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
      : isActive
        ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
        : 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20';

    const statusLabel = isPaused ? 'Paused' : isActive ? 'Processing' : 'Idle';
    const statusDot = isPaused
      ? 'bg-amber-500'
      : isActive
        ? 'bg-emerald-500'
        : 'bg-slate-400 dark:bg-slate-600';

    return (
      <div key={source} className="flex flex-col justify-between h-full bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-850 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-200 dark:hover:border-slate-700 transition-all duration-300 p-5">
        <div>
          {/* Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                {isActive && !isPaused && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                )}
                <span className={`relative inline-flex rounded-full h-2 w-2 ${statusDot}`}></span>
              </span>
              <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200 tracking-tight">{label}</h3>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColor}`}>
              {statusLabel}
            </span>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-2 gap-2 mb-3">
            {/* Active Box */}
            <div className="p-3 rounded-xl bg-emerald-500/[0.03] dark:bg-emerald-500/[0.02] border border-emerald-500/10 flex items-center justify-between transition-colors hover:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/[0.04]">
              <div>
                <div className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold uppercase tracking-wider">Active</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5">{q.active.toLocaleString()}</div>
              </div>
              <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
                <Zap className="w-4 h-4" />
              </div>
            </div>
            {/* Waiting Box */}
            <div className="p-3 rounded-xl bg-blue-500/[0.03] dark:bg-blue-500/[0.02] border border-blue-500/10 flex items-center justify-between transition-colors hover:bg-blue-500/[0.06] dark:hover:bg-blue-500/[0.04]">
              <div>
                <div className="text-[10px] text-blue-600 dark:text-blue-400 font-semibold uppercase tracking-wider">Waiting</div>
                <div className="text-xl font-bold text-slate-800 dark:text-slate-100 tabular-nums mt-0.5">{q.waiting.toLocaleString()}</div>
              </div>
              <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
                <Clock className="w-4 h-4" />
              </div>
            </div>
          </div>

          {/* Secondary Stats */}
          <div className="grid grid-cols-3 gap-1.5 mb-4 text-center">
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Delayed</div>
              <div className="text-xs font-bold text-amber-500 dark:text-amber-400 tabular-nums mt-0.5">{q.delayed.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Completed</div>
              <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tabular-nums mt-0.5">{q.completed.toLocaleString()}</div>
            </div>
            <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 transition-colors hover:bg-slate-100/50 dark:hover:bg-slate-800/60">
              <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Failed</div>
              <div className="text-xs font-bold text-red-500 dark:text-red-400 tabular-nums mt-0.5">{q.failed.toLocaleString()}</div>
            </div>
          </div>

          {/* Job Type Breakdown */}
          {source !== 'scheduler' ? (
            (source === 'github' || source === 'huggingface') ? (
              <div className="mb-4 p-3 rounded-xl bg-blue-500/[0.02] dark:bg-blue-500/[0.01] border border-blue-500/5 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">{t("queueBreakdown")}</span>
                  <span className="font-bold tabular-nums text-blue-500">{t("totalJobs", { count: q.discovery })}</span>
                </div>
                
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-blue-500 font-bold">{t("discoveryJobs")}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t("discoveryDesc")}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">{q.discovery.toLocaleString()}</div>
                </div>

                {/* Split Progress Bar */}
                <div className="w-full h-1 bg-blue-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 transition-all duration-500" style={{ width: q.discovery > 0 ? '100%' : '0%' }} />
                </div>
              </div>
            ) : source === 'social' ? (
              <div className="mb-4 p-3 rounded-xl bg-indigo-500/[0.02] dark:bg-indigo-500/[0.01] border border-indigo-500/5 space-y-2 flex flex-col justify-center min-h-[96px]">
                <div className="text-[10px] text-indigo-650 dark:text-indigo-400 font-bold uppercase tracking-wider text-center">Social Mentions Crawler</div>
                <p className="text-[11px] text-slate-550 dark:text-slate-400 mt-1 leading-relaxed text-center font-medium">
                  Quét định kỳ thảo luận trên Reddit &amp; Hacker News của dự án trên 100 stars.
                </p>
              </div>
            ) : (
              <div className="mb-4 p-3 rounded-xl bg-amber-500/[0.02] dark:bg-amber-500/[0.01] border border-amber-500/5 space-y-2">
                <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                  <span className="font-semibold uppercase tracking-wider">{t("queueBreakdown")}</span>
                  <span className="font-bold tabular-nums text-amber-500">{t("totalJobs", { count: q.update })}</span>
                </div>
                
                <div className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 flex items-center justify-between">
                  <div>
                    <div className="text-[9px] uppercase tracking-wider text-amber-500 font-bold">{t("updateJobs")}</div>
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">{t("updateDesc")}</div>
                  </div>
                  <div className="text-sm font-bold text-slate-800 dark:text-slate-200 tabular-nums">{q.update.toLocaleString()}</div>
                </div>

                {/* Split Progress Bar */}
                <div className="w-full h-1 bg-amber-500/10 rounded-full overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all duration-500" style={{ width: q.update > 0 ? '100%' : '0%' }} />
                </div>
              </div>
            )
          ) : (
            <div className="mb-4 p-3 rounded-xl bg-slate-500/[0.02] dark:bg-slate-500/[0.01] border border-slate-500/5 space-y-2 flex flex-col justify-center min-h-[96px]">
              <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold text-center">Scheduler Controller</div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 leading-relaxed text-center">
                Kích hoạt và quản lý tiến trình lập lịch chạy các công việc tự động định kỳ.
              </p>
            </div>
          )}

          {/* Total processed */}
          <div className="flex items-center justify-between text-[10px] text-slate-500 dark:text-slate-400 mb-3 px-1 border-t border-slate-100 dark:border-slate-800/80 pt-3">
            <span>Processed: <strong className="text-slate-700 dark:text-slate-300 font-semibold">{q.total.toLocaleString()}</strong></span>
            <span>Success: <strong className="text-slate-700 dark:text-slate-300 font-semibold">
              {q.total > 0 ? `${((q.completed / q.total) * 100).toFixed(1)}%` : 'N/A'}
            </strong></span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/80 mt-auto">
          {isPaused ? (
            <ActionButton
              icon={Play}
              label="Resume"
              onClick={() => handleAction('resume', source)}
              loading={isLoading('resume', source)}
              disabled={isAnyActionLoading}
              variant="success"
            />
          ) : (
            <ActionButton
              icon={Pause}
              label="Pause"
              onClick={() => handleAction('pause', source)}
              loading={isLoading('pause', source)}
              disabled={isAnyActionLoading}
              variant="warning"
            />
          )}
          <ActionButton
            icon={Trash2}
            label="Drain"
            onClick={() => handleAction('drain', source)}
            loading={isLoading('drain', source)}
            variant="danger"
            disabled={isAnyActionLoading || (q.waiting === 0 && q.delayed === 0)}
          />
          <ActionButton
            icon={RotateCcw}
            label="Retry"
            onClick={() => handleAction('retry', source)}
            loading={isLoading('retry', source)}
            variant="default"
            disabled={isAnyActionLoading || q.currentFailed === 0}
          />
          {source === 'social' && (
            <div className="w-full mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800/80">
              <ActionButton
                icon={Play}
                label={isSocialEnqueuing ? "Social Job..." : "Run Social Job"}
                onClick={() => handleTriggerJob('social-mentions')}
                loading={loadingActions.has('trigger-social-mentions') || isSocialEnqueuing}
                disabled={isAnyActionLoading || isSocialEnqueuing}
                variant="primary"
              />
            </div>
          )}
          {source === 'scheduler' && (
            <div className="grid grid-cols-3 gap-1.5 w-full mt-2 pt-2 border-t border-dashed border-slate-100 dark:border-slate-800/80">
              <ActionButton
                icon={Play}
                label={isDiscoveryEnqueuing ? "Discovery..." : "Discovery"}
                onClick={() => handleTriggerJob('daily-discovery')}
                loading={loadingActions.has('trigger-daily-discovery') || isDiscoveryEnqueuing}
                disabled={isAnyActionLoading || isDiscoveryEnqueuing}
                variant="primary"
              />
              <ActionButton
                icon={Play}
                label={isUpdateEnqueuing ? "Update..." : "Update"}
                onClick={() => handleTriggerJob('daily-update')}
                loading={loadingActions.has('trigger-daily-update') || isUpdateEnqueuing}
                disabled={isAnyActionLoading || isUpdateEnqueuing}
                variant="primary"
              />
              <ActionButton
                icon={Play}
                label={isSocialEnqueuing ? "Social..." : "Social"}
                onClick={() => handleTriggerJob('social-mentions')}
                loading={loadingActions.has('trigger-social-mentions') || isSocialEnqueuing}
                disabled={isAnyActionLoading || isSocialEnqueuing}
                variant="primary"
              />
            </div>
          )}
        </div>
      </div>
    );
  };
  const totalPending = totalUpdateJobs + totalDiscoveryJobs;
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
        <div className="p-4 rounded-2xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 shadow-sm flex flex-col gap-3">
          {hasActiveScheduler && (
            <div className="flex items-center gap-3 text-emerald-600 dark:text-emerald-400">
              <div className="p-1.5 rounded-lg bg-emerald-500/10 dark:bg-emerald-500/[0.05] flex items-center justify-center">
                <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              </div>
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
          {totalDiscoveryJobs > 0 && (
            <div className="flex items-center gap-3 text-blue-600 dark:text-blue-400">
              <div className="p-1.5 rounded-lg bg-blue-500/10 dark:bg-blue-500/[0.05] flex items-center justify-center">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-blue-500"></span>
                </span>
              </div>
              <div className="text-[11px] font-semibold">
                {t("discoveryProgress", { count: totalDiscoveryJobs })}
              </div>
            </div>
          )}
          {totalUpdateJobs > 0 && (
            <div className="flex items-center gap-3 text-amber-600 dark:text-amber-400">
              <div className="p-1.5 rounded-lg bg-amber-500/10 dark:bg-amber-500/[0.05] flex items-center justify-center">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
                </span>
              </div>
              <div className="text-[11px] font-semibold">
                {t("updatingProgress", { count: totalUpdateJobs })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Queue cards */}
      {stats ? (
        <div className="space-y-6">
          {/* Discovery Crawlers Group */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-4 bg-blue-500 rounded-full"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {discoveryGroupText}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {renderQueueCard('github', 'GitHub Crawler', stats.github)}
              {renderQueueCard('huggingface', 'HF Crawler', stats.huggingface)}
            </div>
          </div>

          {/* Metrics Updaters & Scheduler Group */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 px-1">
              <span className="w-1.5 h-4 bg-amber-500 rounded-full"></span>
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {updaterGroupText}
              </h4>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {renderQueueCard('github-updater', 'GH Updater', stats.githubUpdater)}
              {renderQueueCard('hf-updater', 'HF Updater', stats.hfUpdater)}
              {renderQueueCard('social', 'Social Crawler', stats.social)}
              {renderQueueCard('scheduler', 'Scheduler', stats.scheduler)}
            </div>
          </div>
        </div>
      ) : (
        <div className="apple-utility-card flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink-muted-48)]" />
          <span className="ml-2 text-[var(--color-ink-muted-48)]">Loading queue stats...</span>
        </div>
      )}

      {/* API Quota & Token Health Telemetry */}
      {((tokensHealth && tokensHealth.length > 0) || hfTokenHealth) && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          {/* GitHub API Tokens Health Monitor */}
          {tokensHealth && tokensHealth.length > 0 && (
            <div className="apple-utility-card lg:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">GitHub API Tokens Health</h3>
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 text-emerald-500">
                  {tokensHealth.filter(t => t.status === 'active').length} / {tokensHealth.length} Token(s) Active
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {tokensHealth.map((token) => {
                  const corePercent = token.coreLimit > 0 ? (token.coreRemaining / token.coreLimit) * 100 : 0;
                  const searchPercent = token.searchLimit > 0 ? (token.searchRemaining / token.searchLimit) * 100 : 0;
                  
                  // Status Styling
                  const statusColors = {
                    active: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20',
                    exhausted: 'bg-amber-500/10 text-amber-500 border-amber-500/20',
                    invalid: 'bg-red-500/10 text-red-500 border-red-500/20',
                  };

                  const getResetText = (resetMs: number) => {
                    if (!resetMs) return '';
                    const diffSecs = Math.max(0, Math.ceil((resetMs - Date.now()) / 1000));
                    if (diffSecs === 0) return 'Resets now';
                    if (diffSecs < 60) return `Resets in ${diffSecs}s`;
                    return `Resets in ${Math.ceil(diffSecs / 60)}m`;
                  };

                  return (
                    <div key={token.index} className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono font-bold text-[var(--color-ink)]">
                            {token.maskedToken}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-muted-48)] font-medium">
                            Index {token.index}
                          </span>
                        </div>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${statusColors[token.status]}`}>
                          {token.status.toUpperCase()}
                        </span>
                      </div>

                      <div className="space-y-3">
                        {/* Core Rate Limit */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[var(--color-ink-muted-80)]">
                            <span>Core (Scraping Details)</span>
                            <span className="font-mono tabular-nums">{token.coreRemaining.toLocaleString()} / {token.coreLimit.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-divider-soft)]">
                            <div 
                              className={`h-full transition-all duration-500 ${token.status === 'invalid' ? 'bg-red-500' : corePercent < 15 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                              style={{ width: `${corePercent}%` }}
                            />
                          </div>
                          {token.status === 'exhausted' && (
                            <div className="text-[9px] text-amber-500 text-right mt-0.5 font-medium">
                              {getResetText(token.coreResetTime)}
                            </div>
                          )}
                        </div>

                        {/* Search Rate Limit */}
                        <div className="space-y-1">
                          <div className="flex justify-between text-[11px] text-[var(--color-ink-muted-80)]">
                            <span>Search (Daily Discovery)</span>
                            <span className="font-mono tabular-nums">{token.searchRemaining.toLocaleString()} / {token.searchLimit.toLocaleString()}</span>
                          </div>
                          <div className="w-full h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-divider-soft)]">
                            <div 
                              className={`h-full transition-all duration-500 ${token.status === 'invalid' ? 'bg-red-500' : searchPercent < 15 ? 'bg-amber-500' : 'bg-blue-500'}`}
                              style={{ width: `${searchPercent}%` }}
                            />
                          </div>
                          {token.searchRemaining < token.searchLimit && (
                            <div className="text-[9px] text-[var(--color-ink-muted-48)] text-right mt-0.5 font-medium">
                              {getResetText(token.searchResetTime)}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* HuggingFace API Token Health Monitor */}
          <div className="apple-utility-card lg:col-span-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <h3 className="text-sm font-semibold text-[var(--color-ink)]">HuggingFace API Telemetry</h3>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${hfTokenHealth ? hfTokenHealth.status === 'exhausted' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 'bg-slate-500/10 text-slate-500 border-slate-500/20'}`}>
                  {hfTokenHealth ? hfTokenHealth.status.toUpperCase() : 'UNKNOWN'}
                </span>
              </div>

              {hfTokenHealth ? (
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-[var(--color-ink)]">
                      hf_•••••••• (Token Pool)
                    </span>
                    <span className="text-[10px] text-[var(--color-ink-muted-48)] font-medium">
                      Last Crawl Status
                    </span>
                  </div>

                  <div className="space-y-3">
                    <div className="space-y-1">
                      <div className="flex justify-between text-[11px] text-[var(--color-ink-muted-80)]">
                        <span>Rate Limit Quota</span>
                        <span className="font-mono tabular-nums">
                          {hfTokenHealth.remaining.toLocaleString()} / {hfTokenHealth.limit.toLocaleString()}
                        </span>
                      </div>
                      {(() => {
                        const pct = hfTokenHealth.limit > 0 ? (hfTokenHealth.remaining / hfTokenHealth.limit) * 100 : 0;
                        return (
                          <div className="w-full h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-divider-soft)]">
                            <div 
                              className={`h-full transition-all duration-500 ${hfTokenHealth.status === 'exhausted' ? 'bg-amber-500' : pct < 15 ? 'bg-orange-500' : 'bg-emerald-500'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        );
                      })()}
                    </div>

                    {hfTokenHealth.status === 'exhausted' && (
                      <div className="text-[10px] text-amber-500 text-right mt-1 font-medium font-mono">
                        Quota resets in {hfResetSeconds}s
                      </div>
                    )}
                    
                    <div className="text-[10px] text-[var(--color-ink-muted-48)] text-right font-mono">
                      Updated: {new Date(hfTokenHealth.timestamp).toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] text-center text-xs text-[var(--color-ink-muted-48)] py-8 font-medium">
                  No HuggingFace token telemetry recorded yet. Trigger a HF crawl task to capture headers.
                </div>
              )}
            </div>
          </div>
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
    default: 'border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800/60 bg-white dark:bg-slate-900',
    primary: 'border-blue-200/50 dark:border-blue-800/30 text-blue-600 dark:text-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/20 bg-white dark:bg-slate-900',
    success: 'border-emerald-200/50 dark:border-emerald-800/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50/50 dark:hover:bg-emerald-950/20 bg-white dark:bg-slate-900',
    warning: 'border-amber-200/50 dark:border-amber-800/30 text-amber-600 dark:text-amber-400 hover:bg-amber-50/50 dark:hover:bg-amber-950/20 bg-white dark:bg-slate-900',
    danger: 'border-red-200/50 dark:border-red-800/30 text-red-600 dark:text-red-400 hover:bg-red-50/50 dark:hover:bg-red-950/20 bg-white dark:bg-slate-900',
  };

  return (
    <button
      onClick={onClick}
      disabled={loading || disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-medium transition-all duration-200 active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer ${variantStyles[variant]}`}
      aria-label={label}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <Icon className="w-3.5 h-3.5" />
      )}
      {label}
    </button>
  );
}
