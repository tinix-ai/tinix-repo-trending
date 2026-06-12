"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Play, Loader2, Trash2, RefreshCw } from "lucide-react";
import { getScheduledJobs, triggerJobNow, removeScheduledJob, type ScheduledJob } from "@/app/actions";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

export function ScheduledJobsTable() {
  const t = useTranslations("Admin");
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadJobs = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchJobs() {
      const data = await getScheduledJobs();
      if (active) {
        setJobs(data);
        setLoading(false);
      }
    }
    fetchJobs();
    return () => {
      active = false;
    };
  }, [refreshKey]);

  const handleTrigger = async (name: string) => {
    setActionLoading(`trigger-${name}`);
    const actionPromise = async () => {
      await triggerJobNow(name);
      return t("jobTriggered", { name });
    };

    toast.promise(actionPromise(), {
      loading: t("triggeringJob", { name }),
      success: (msg) => msg,
      error: t("triggerJobFailed", { name }),
      finally: () => setActionLoading(null)
    });
  };

  const handleRemove = async (key: string) => {
    if (!confirm(t("confirmRemoveJob"))) return;
    setActionLoading(`remove-${key}`);
    const actionPromise = async () => {
      await removeScheduledJob(key);
      await loadJobs();
      return t("jobRemoved");
    };

    toast.promise(actionPromise(), {
      loading: t("removingJob"),
      success: (msg) => msg,
      error: t("removeJobFailed"),
      finally: () => setActionLoading(null)
    });
  };

  if (loading) {
    return (
      <div className="apple-utility-card flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-[var(--color-ink-muted-48)]" />
        <span className="ml-2 text-[var(--color-ink-muted-48)]">{t("loadingJobs")}</span>
      </div>
    );
  }

  return (
    <div className="apple-utility-card">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">{t("cronSchedules")}</h3>
            <p className="text-xs text-[var(--color-ink-muted-80)]">{t("repeatableJobsDesc")}</p>
          </div>
        </div>
        <button
          onClick={loadJobs}
          disabled={loading}
          className="apple-btn-secondary py-1.5 px-3 text-xs flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {t("refresh")}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider-soft)]">
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("jobName")}</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("scheduleCron")}</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("nextRun")}</th>
              <th className="py-2.5 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium text-right">{t("actions")}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-sm text-[var(--color-ink-muted-48)]">
                  {t("noJobsFound")}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.key} className="border-b border-[var(--color-divider-soft)] last:border-0 hover:bg-[var(--color-canvas-parchment)] transition-colors">
                  <td className="py-3 px-3">
                    <span className="text-sm font-medium text-[var(--color-ink)]">{job.name}</span>
                    <div className="text-[10px] text-[var(--color-ink-muted-48)] font-mono truncate max-w-[150px]">{job.id}</div>
                  </td>
                  <td className="py-3 px-3">
                    <span className="inline-flex items-center px-2 py-1 rounded bg-[var(--color-bg-secondary)] text-xs font-mono border border-[var(--color-hairline)]">
                      {job.pattern}
                    </span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="text-xs text-[var(--color-ink)]">
                      {new Date(job.next).toLocaleString()}
                    </span>
                  </td>
                  <td className="py-3 px-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => handleTrigger(job.name)}
                        disabled={actionLoading === `trigger-${job.name}`}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-action-blue)]/30 text-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/5 text-xs font-medium transition-colors disabled:opacity-50"
                      >
                        {actionLoading === `trigger-${job.name}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        {t("runNow")}
                      </button>
                      <button
                        onClick={() => handleRemove(job.key)}
                        disabled={actionLoading === `remove-${job.key}`}
                        className="p-1.5 rounded-lg border border-red-500/30 text-red-500 hover:bg-red-500/5 transition-colors disabled:opacity-50"
                        title={t("removeSchedule")}
                      >
                        {actionLoading === `remove-${job.key}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
