"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
import {
  fetchDetailedQueueStats,
  pauseQueue,
  resumeQueue,
  drainQueue,
  retryFailedJobs,
  triggerCrawlerSync,
} from "@/app/actions";

interface QueueDetails {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  isPaused: boolean;
  total: number;
}

interface DetailedStats {
  github: QueueDetails;
  huggingface: QueueDetails;
}

type ActionType = 'pause' | 'resume' | 'drain' | 'retry' | 'sync';
type SourceType = 'github' | 'huggingface';

interface Toast {
  id: number;
  message: string;
  type: 'success' | 'error';
}

export function QueueControlPanel() {
  const [stats, setStats] = useState<DetailedStats | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [countdown, setCountdown] = useState(5);
  const [loadingActions, setLoadingActions] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastIdRef = useRef(0);

  const addToast = useCallback((message: string, type: 'success' | 'error') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  }, []);

  const loadStats = useCallback(async () => {
    const data = await fetchDetailedQueueStats();
    setStats(data);
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

    try {
      let result;
      switch (action) {
        case 'pause': result = await pauseQueue(source); break;
        case 'resume': result = await resumeQueue(source); break;
        case 'drain': result = await drainQueue(source); break;
        case 'retry': result = await retryFailedJobs(source); break;
        case 'sync': result = await triggerCrawlerSync(source); break;
      }
      addToast(result.message, result.success ? 'success' : 'error');
      await loadStats();
    } catch {
      addToast(`Failed to execute ${action}`, 'error');
    } finally {
      setLoadingActions(prev => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const isLoading = (action: ActionType, source: SourceType) =>
    loadingActions.has(`${action}-${source}`);

  const renderQueueCard = (source: SourceType, label: string, q: QueueDetails) => {
    const statusColor = q.isPaused
      ? 'bg-amber-500/10 text-amber-500'
      : q.active > 0
        ? 'bg-emerald-500/10 text-emerald-500'
        : 'bg-[var(--color-ink-muted-48)]/10 text-[var(--color-ink-muted-48)]';

    const statusLabel = q.isPaused ? 'Paused' : q.active > 0 ? 'Processing' : 'Idle';
    const statusDot = q.isPaused
      ? 'bg-amber-500'
      : q.active > 0
        ? 'bg-emerald-500 animate-pulse'
        : 'bg-[var(--color-ink-muted-48)]';

    return (
      <div key={source} className="apple-utility-card">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className={`w-2.5 h-2.5 rounded-full ${statusDot}`} />
            <h3 className="text-apple-body-strong">{label}</h3>
            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
          </div>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-5 gap-3 mb-6">
          {[
            { label: 'Active', value: q.active, icon: Zap, color: 'text-emerald-500' },
            { label: 'Waiting', value: q.waiting, icon: Clock, color: 'text-blue-500' },
            { label: 'Delayed', value: q.delayed, icon: Loader2, color: 'text-amber-500' },
            { label: 'Completed', value: q.completed, icon: CheckCircle2, color: 'text-emerald-400' },
            { label: 'Failed', value: q.failed, icon: AlertTriangle, color: 'text-red-500' },
          ].map(stat => (
            <div key={stat.label} className="text-center p-3 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
              <stat.icon className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
              <div className="text-lg font-semibold text-[var(--color-ink)] tabular-nums">{stat.value.toLocaleString()}</div>
              <div className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Total processed */}
        <div className="flex items-center justify-between text-xs text-[var(--color-ink-muted-80)] mb-4 px-1">
          <span>Total Processed: <strong className="text-[var(--color-ink)]">{q.total.toLocaleString()}</strong></span>
          <span>Success Rate: <strong className="text-[var(--color-ink)]">
            {q.total > 0 ? `${((q.completed / q.total) * 100).toFixed(1)}%` : 'N/A'}
          </strong></span>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-[var(--color-divider-soft)]">
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
          <ActionButton
            icon={RefreshCw}
            label="Run Sync"
            onClick={() => handleAction('sync', source)}
            loading={isLoading('sync', source)}
            variant="primary"
          />
        </div>
      </div>
    );
  };

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
          className="apple-btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5"
          aria-label="Refresh queue stats"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>

      {/* Queue cards */}
      {stats ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderQueueCard('github', 'GitHub Crawler', stats.github)}
          {renderQueueCard('huggingface', 'HuggingFace Crawler', stats.huggingface)}
        </div>
      ) : (
        <div className="apple-utility-card flex items-center justify-center py-12">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink-muted-48)]" />
          <span className="ml-2 text-[var(--color-ink-muted-48)]">Loading queue stats...</span>
        </div>
      )}

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-3 rounded-xl text-sm font-medium shadow-lg animate-slide-in-right ${
              toast.type === 'success'
                ? 'bg-emerald-500 text-white'
                : 'bg-red-500 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
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
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed ${variantStyles[variant]}`}
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
