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
  Activity,
  Server,
  Search,
  MessageSquare,
  Trophy,
  X,
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
  cancelJobNow,
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
  graphqlLimit: number;
  graphqlRemaining: number;
  graphqlResetTime: number;
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
  const isAchievementEnqueuing = isSchedulerJobActive('generate-achievements');

  const isQueueActionLoading = (source: SourceType) => {
    return Array.from(loadingActions).some(key => {
      return key.endsWith(`-${source}`) || 
             (source === 'scheduler' && (key.startsWith('trigger-') || key.startsWith('cancel-')));
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
    const actionKey = `trigger-${name}`;
    setLoadingActions(prev => new Set(prev).add(actionKey));
    try {
      const result = await triggerJobNow(name);
      if (result.success) {
        toast.success(`Started job: ${name}`, {
          description: "Nhiệm vụ đã được đưa vào hàng đợi và đang thực thi.",
        });
        await loadStats();
      } else {
        toast.error(`Failed to start job: ${name}`, {
          description: result.message,
        });
      }
    } catch (err) {
      toast.error(`Error starting job: ${name}`);
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  const handleCancelJob = async (name: string) => {
    const actionKey = `cancel-${name}`;
    setLoadingActions(prev => new Set(prev).add(actionKey));
    try {
      const result = await cancelJobNow(name);
      if (result.success) {
        toast.success(`Cancel signal sent to ${name}`, {
          description: "Tiến trình sẽ dừng lại trong vài giây tới một cách an toàn.",
        });
        // We poll a few times to let the UI update when it actually stops
        setTimeout(loadStats, 1000);
        setTimeout(loadStats, 3000);
      } else {
        toast.error(`Failed to cancel job: ${name}`, {
          description: result.message,
        });
      }
    } catch (err) {
      toast.error(`Error cancelling job: ${name}`);
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(actionKey);
        return next;
      });
    }
  };

  const isLoading = (action: ActionType, source: SourceType) =>
    loadingActions.has(`${action}-${source}`);

  const renderHealthTableRow = (source: SourceType, label: string, q: QueueDetails) => {
    const isAnyActionLoading = isQueueActionLoading(source);
    const isActive = q.active > 0 || q.waiting > 0;
    const isPaused = q.isPaused;

    const statusDot = isPaused
      ? 'bg-amber-500'
      : isActive
        ? 'bg-emerald-500'
        : 'bg-slate-400 dark:bg-slate-600';

    return (
      <tr key={source} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
        <td className="px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              {isActive && !isPaused && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              )}
              <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${statusDot}`}></span>
            </span>
            <span className="font-semibold text-[13px] text-slate-800 dark:text-slate-200">{label}</span>
          </div>
        </td>
        <td className="px-4 py-3 text-right tabular-nums font-semibold text-emerald-600 dark:text-emerald-400">{q.active.toLocaleString()}</td>
        <td className="px-4 py-3 text-right tabular-nums font-semibold text-blue-600 dark:text-blue-400">{q.waiting.toLocaleString()}</td>
        <td className="px-4 py-3 text-right tabular-nums text-slate-600 dark:text-slate-300">{q.completed.toLocaleString()}</td>
        <td className="px-4 py-3 text-right tabular-nums font-medium text-red-500">{q.failed.toLocaleString()}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-1.5">
            {isPaused ? (
              <button onClick={() => handleAction('resume', source)} disabled={isAnyActionLoading} className="p-1.5 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 hover:bg-emerald-100 disabled:opacity-50 transition-colors" title="Resume"><Play className="w-3.5 h-3.5"/></button>
            ) : (
              <button onClick={() => handleAction('pause', source)} disabled={isAnyActionLoading} className="p-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 text-amber-600 hover:bg-amber-100 disabled:opacity-50 transition-colors" title="Pause"><Pause className="w-3.5 h-3.5"/></button>
            )}
            <button onClick={() => handleAction('drain', source)} disabled={isAnyActionLoading || (q.waiting === 0 && q.delayed === 0)} className="p-1.5 rounded-md bg-red-50 dark:bg-red-500/10 text-red-600 hover:bg-red-100 disabled:opacity-50 transition-colors" title="Drain"><Trash2 className="w-3.5 h-3.5"/></button>
            <button onClick={() => handleAction('retry', source)} disabled={isAnyActionLoading || q.currentFailed === 0} className="p-1.5 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-600 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 transition-colors" title="Retry"><RotateCcw className="w-3.5 h-3.5"/></button>
          </div>
        </td>
      </tr>
    );
  };

  const renderSchedulerJobController = (
    title: string,
    jobName: string,
    description: string,
    isActive: boolean,
    icon: React.ReactNode
  ) => {
    const isTriggerLoading = loadingActions.has(`trigger-${jobName}`);
    const isCancelLoading = loadingActions.has(`cancel-${jobName}`);
    
    return (
      <div className="flex items-center justify-between p-3 rounded-lg border border-border/50 bg-background/50 hover:bg-muted/50 transition-colors">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-md ${isActive ? 'bg-primary/20 text-primary animate-pulse' : 'bg-muted text-muted-foreground'}`}>
            {icon}
          </div>
          <div>
            <div className="font-medium flex items-center gap-2">
              {title}
              {isActive && (
                <span className="flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-2 w-2 rounded-full bg-primary opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-primary"></span>
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground">{description}</div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {isActive ? (
            <button 
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 bg-red-500 text-white shadow-sm hover:bg-red-500/90 h-8 px-3 rounded-md gap-1.5"
              onClick={() => handleCancelJob(jobName)}
              disabled={isCancelLoading}
            >
              {isCancelLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
              Cancel
            </button>
          ) : (
            <button 
              className="inline-flex items-center justify-center whitespace-nowrap text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 border border-input bg-transparent shadow-sm hover:bg-primary/10 hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 h-8 px-3 rounded-md gap-1.5"
              onClick={() => handleTriggerJob(jobName)}
              disabled={isTriggerLoading}
            >
              {isTriggerLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              Run
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderSchedulerCard = () => {
    if (!stats) return null;

    return (
      <div className="col-span-1 rounded-xl border border-[var(--color-action-blue)]/20 shadow-lg shadow-[var(--color-action-blue)]/5 relative overflow-hidden bg-gradient-to-br from-[var(--color-bg-primary)] to-[var(--color-bg-secondary)]">
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-[var(--color-action-blue)]/40 via-[var(--color-action-blue)] to-[var(--color-action-blue)]/40"></div>
        <div className="flex flex-col space-y-1.5 p-6 pb-3">
          <div className="space-y-1">
            <h3 className="font-semibold leading-none tracking-tight text-xl flex items-center gap-2 text-[var(--color-ink)]">
              <Clock className="w-5 h-5 text-[var(--color-action-blue)]" />
              Scheduler Command Center
            </h3>
            <p className="text-sm text-[var(--color-ink-muted-80)]">
              Quản lý và kích hoạt thủ công các tiến trình định kỳ
            </p>
          </div>
        </div>
        <div className="p-6 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {renderSchedulerJobController(
              "Daily Discovery", 
              "daily-discovery", 
              "Tìm kiếm repo/model mới trending",
              isDiscoveryEnqueuing,
              <Search className="w-4 h-4" />
            )}
            
            {renderSchedulerJobController(
              "Daily Update", 
              "daily-update", 
              "Cập nhật stars/likes dự án đã có",
              isUpdateEnqueuing,
              <RefreshCw className="w-4 h-4" />
            )}
            
            {renderSchedulerJobController(
              "Social Mentions", 
              "social-mentions", 
              "Crawl bài đăng HN, Reddit, X",
              isSocialEnqueuing,
              <MessageSquare className="w-4 h-4" />
            )}
            
            {renderSchedulerJobController(
              "Achievements", 
              "generate-achievements", 
              "Tính toán thành tựu & huy hiệu",
              isAchievementEnqueuing,
              <Trophy className="w-4 h-4" />
            )}
          </div>
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

      {/* Queue cards layout */}
      {stats ? (
        <div className="flex flex-col gap-6">
          {/* Master: Scheduler Command Center */}
          <div className="w-full">
            <h2 className="text-sm font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-[var(--color-action-blue)]" />
              Bộ Điều Khiển Trung Tâm (Command Center)
            </h2>
            {renderSchedulerCard()}
          </div>

          {/* Detail: Health Status Table */}
          <div className="w-full">
            <h2 className="text-sm font-bold text-[var(--color-ink)] mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
              Trạng Thái Hàng Đợi (System Health)
            </h2>
            <div className="apple-utility-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm text-[var(--color-ink)]">
                  <thead className="bg-[var(--color-bg-secondary)] text-[10px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-80)] border-b border-[var(--color-divider-soft)]">
                    <tr>
                      <th className="px-4 py-3 whitespace-nowrap">Tên Hàng Đợi</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Active</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Waiting</th>
                      <th className="px-4 py-3 text-right hidden sm:table-cell whitespace-nowrap">Completed</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Failed</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Thao tác</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--color-divider-soft)]">
                    {renderHealthTableRow('github', 'GitHub Crawler', stats.github)}
                    {renderHealthTableRow('huggingface', 'HF Crawler', stats.huggingface)}
                    {renderHealthTableRow('github-updater', 'GH Updater', stats.githubUpdater)}
                    {renderHealthTableRow('hf-updater', 'HF Updater', stats.hfUpdater)}
                    {renderHealthTableRow('social', 'Social Crawler', stats.social)}
                  </tbody>
                </table>
              </div>
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

                        {/* GraphQL Rate Limit */}
                        {token.graphqlLimit !== undefined && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-[11px] text-[var(--color-ink-muted-80)]">
                              <span>GraphQL (Crawler & Discovery)</span>
                              <span className="font-mono tabular-nums">{token.graphqlRemaining.toLocaleString()} / {token.graphqlLimit.toLocaleString()}</span>
                            </div>
                            <div className="w-full h-2 bg-[var(--color-canvas)] rounded-full overflow-hidden border border-[var(--color-divider-soft)]">
                              <div 
                                className={`h-full transition-all duration-500 ${token.status === 'invalid' ? 'bg-red-500' : (token.graphqlRemaining / token.graphqlLimit * 100) < 15 ? 'bg-amber-500' : 'bg-teal-500'}`}
                                style={{ width: `${token.graphqlLimit > 0 ? (token.graphqlRemaining / token.graphqlLimit) * 100 : 0}%` }}
                              />
                            </div>
                            {token.graphqlRemaining < token.graphqlLimit && (
                              <div className="text-[9px] text-[var(--color-ink-muted-48)] text-right mt-0.5 font-medium">
                                {getResetText(token.graphqlResetTime)}
                              </div>
                            )}
                          </div>
                        )}
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
