"use client";

import { useState, useEffect, useCallback } from "react";
import { Clock, Loader2, RefreshCw } from "lucide-react";
import { getScheduledJobs, fetchQueueStats, type ScheduledJob } from "@/app/actions";
import { useTranslations } from "next-intl";

export function ScheduledJobsTable() {
  const t = useTranslations("Admin");
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [pendingJobsCount, setPendingJobsCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const loadJobs = useCallback(() => {
    setRefreshKey(prev => prev + 1);
  }, []);

  useEffect(() => {
    let active = true;
    async function fetchJobs() {
      try {
        const [jobsData, queueStats] = await Promise.all([
          getScheduledJobs(),
          fetchQueueStats(),
        ]);
        if (active) {
          setJobs(jobsData);
          const totalPending = 
            queueStats.github.waiting + 
            queueStats.github.active + 
            queueStats.huggingface.waiting + 
            queueStats.huggingface.active;
          setPendingJobsCount(totalPending);
          setLoading(false);
        }
      } catch (error) {
        console.error("Error fetching jobs and queue stats:", error);
      }
    }
    fetchJobs();

    const interval = setInterval(fetchJobs, 3000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

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
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500">
            <Clock className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--color-ink)]">{t("cronSchedules")}</h3>
            <p className="text-[11px] text-[var(--color-ink-muted-80)]">{t("repeatableJobsDesc")}</p>
          </div>
        </div>
        <button
          onClick={loadJobs}
          disabled={loading}
          className="apple-btn-secondary py-1 px-2.5 text-[11px] flex items-center gap-1.5 disabled:opacity-50"
        >
          <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} /> {t("refresh")}
        </button>
      </div>

      {/* Active System Tasks & Crawlers Banner */}
      {(pendingJobsCount > 0 || jobs.some(j => j.isActive)) && (
        <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 flex flex-col gap-3">
          {jobs.some(j => j.isActive) && (
            <div className="flex items-center gap-3">
              <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
              <div className="text-[11px] font-semibold">
                {t("runningSchedulerJobs", {
                  jobs: jobs
                    .filter(j => j.isActive)
                    .map(j => {
                      if (j.name === 'daily-discovery') return 'Daily Discovery (scanning GitHub and HuggingFace for trending projects)';
                      if (j.name === 'daily-update') return 'Daily Update (generating metrics update queue)';
                      if (j.name === 'social-mentions') return 'Social Mentions Update (scanning HN and Reddit for projects with > 100 stars)';
                      return j.name;
                    })
                    .join(', ')
                })}
              </div>
            </div>
          )}
          {pendingJobsCount > 0 && (
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </div>
              <div className="text-[11px] font-medium">
                {t("activeCrawlers", { count: pendingJobsCount })}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-[var(--color-divider-soft)]">
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("jobName")}</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("scheduleCron")}</th>
              <th className="py-2 px-3 text-[10px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-medium">{t("nextRun")}</th>
            </tr>
          </thead>
          <tbody>
            {jobs.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-8 text-center text-sm text-[var(--color-ink-muted-48)]">
                  {t("noJobsFound")}
                </td>
              </tr>
            ) : (
              jobs.map((job) => (
                <tr key={job.key} className="border-b border-[var(--color-divider-soft)] last:border-0 hover:bg-[var(--color-canvas-parchment)] transition-colors">
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-2">
                      {job.isActive && <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />}
                      <span className="text-xs font-semibold text-[var(--color-ink)]">{job.name}</span>
                    </div>
                    <div className="text-[9px] text-[var(--color-ink-muted-48)] font-mono truncate max-w-[150px]">ID: {job.id}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-[var(--color-bg-secondary)] text-[10px] font-mono border border-[var(--color-hairline)]">
                      {job.pattern}
                    </span>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="text-[11px] text-[var(--color-ink)]">
                      {new Date(job.next).toLocaleString()}
                    </span>
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
