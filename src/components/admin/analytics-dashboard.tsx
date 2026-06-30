"use client";

import React, { useState, useEffect } from "react";
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  PieChart, 
  Pie, 
  Cell, 
  Legend, 
  CartesianGrid
} from "recharts";
import { 
  Database, 
  HardDrive, 
  Percent, 
  Server, 
  Clock, 
  CheckCircle,
  Activity
} from "lucide-react";
import { useTranslations } from "next-intl";

interface WorkerStats {
  rss: number;
  heapUsed: number;
  heapTotal: number;
  external?: number;
  cpuUser?: number;
  cpuSystem?: number;
  timestamp: number;
}

interface AnalyticsDashboardProps {
  analyticsData: {
    success: boolean;
    stats: {
      totalProjects: number;
      projectsWithReadme: number;
      compressedSize: number;
      estimatedRawSize: number;
      savedSize: number;
      postgresDbSize?: number;
    };
    categories: Array<{
      name: string;
      projectCount: number;
    }>;
    languages: Array<{
      name: string;
      count: number;
    }>;
    staleness?: {
      total: number;
      fresh24h: number;
      stale24h: number;
      stale48h: number;
      freshPercent: number;
      stale24hPercent: number;
      stale48hPercent: number;
    };
    commonErrors?: Array<{
      name: string;
      value: number;
    }>;
    systemMetrics?: {
      workers: Record<string, WorkerStats>;
      os: {
        platform: string;
        uptime: number;
        totalMem: number;
        freeMem: number;
        loadAvg: number[];
      };
    };
  };
  report: {
    githubTotal: number;
    hfModels: number;
    hfDatasets: number;
    totalProjects: number;
  };
}

export function AnalyticsDashboard({ analyticsData, report }: AnalyticsDashboardProps) {
  const [mounted, setMounted] = useState(false);
  const t = useTranslations("Admin");

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  if (!mounted) {
    return (
      <div className="h-96 flex items-center justify-center text-sm text-[var(--color-ink-muted-48)] font-medium font-mono">
        Loading technical telemetry...
      </div>
    );
  }

  const { stats, categories, languages, staleness, commonErrors, systemMetrics } = analyticsData;

  // Format bytes to readable size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatMB = (bytes: number) => {
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const formatGB = (bytes: number) => {
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + " GB";
  };

  const formatUptime = (seconds: number) => {
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (d > 0) return `${d}d ${h}h ${m}m`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
  };

  const compressionPercent = stats.estimatedRawSize > 0 
    ? Math.round((stats.savedSize / stats.estimatedRawSize) * 100) 
    : 0;

  // Data for Github vs HF Pie chart
  const sourceData = [
    { name: "GitHub", value: report.githubTotal, color: "#3B82F6" }, // Electric Blue
    { name: "HF Models", value: report.hfModels, color: "#06B6D4" }, // Cyan
    { name: "HF Datasets", value: report.hfDatasets, color: "#F97316" }, // Signal Orange
  ];

  // Data for compression bar chart
  const compressionChartData = [
    {
      name: "Original Size",
      value: stats.estimatedRawSize,
      color: "#F97316" // Orange
    },
    {
      name: "Gzipped Storage",
      value: stats.compressedSize,
      color: "#10B981" // Acid Green
    }
  ];

  // Data for Staleness Pie Chart
  const stalenessChartData = staleness ? [
    { name: t("fresh"), value: staleness.fresh24h, color: "#10B981" }, // Acid Green
    { name: t("stale24h"), value: staleness.stale24h, color: "#F97316" }, // Signal Orange
    { name: t("stale48h"), value: staleness.stale48h, color: "#EF4444" } // Red
  ] : [];

  // Helper to render process indicator
  const renderProcessInfo = (name: string, label: string, limitMb: number) => {
    const worker = systemMetrics?.workers[name];
    if (!worker) {
      return (
        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-slate-400 dark:text-slate-600">
          <div className="flex items-center gap-2.5">
            <Server className="w-4 h-4" />
            <span className="text-xs font-semibold font-mono">{label}</span>
          </div>
          <span className="text-[10px] uppercase font-bold tracking-wider">Offline</span>
        </div>
      );
    }

    const pct = Math.min(100, Math.round((worker.heapUsed / (limitMb * 1024 * 1024)) * 100));
    const barColor = pct > 75 ? "bg-red-500" : pct > 50 ? "bg-orange-500" : "bg-emerald-500";
    
    return (
      <div className="p-3.5 rounded-xl bg-white dark:bg-slate-950 border border-slate-100 dark:border-slate-850 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">{label}</span>
          </div>
          <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono">
            RSS: {formatMB(worker.rss)}
          </span>
        </div>
        <div className="space-y-1">
          <div className="flex justify-between text-[9px] text-slate-400 dark:text-slate-500 font-mono">
            <span>Heap: {formatMB(worker.heapUsed)} / {limitMb}MB</span>
            <span>{pct}%</span>
          </div>
          <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden border border-slate-200/20 dark:border-slate-800/30">
            <div className={`h-full ${barColor} transition-all duration-500`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* Telemetry KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight font-mono">
              {formatBytes(stats.estimatedRawSize)}
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              Original Size
            </div>
          </div>
        </div>

        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <HardDrive className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight font-mono">
              {formatBytes(stats.compressedSize)}
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider flex items-center gap-1.5">
              Gzip Compressed 
              <span className="text-[10px] text-emerald-500 font-bold lowercase">
                (saved {formatBytes(stats.savedSize)})
              </span>
            </div>
          </div>
        </div>

        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight font-mono">
              {stats.postgresDbSize ? formatBytes(stats.postgresDbSize) : "N/A"}
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              {t("dbRealSize")}
            </div>
          </div>
        </div>

        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight font-mono">
              {compressionPercent}%
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              Compression Ratio
            </div>
          </div>
        </div>

      </div>

      {/* System Health Telemetry Panel */}
      {systemMetrics && (
        <div className="apple-utility-card border border-[var(--color-divider-soft)] space-y-5">
          <div className="flex items-center justify-between border-b border-[var(--color-divider-soft)] pb-3">
            <div className="flex items-center gap-2">
              <Activity className="w-5 h-5 text-emerald-500" />
              <h3 className="text-apple-body-strong text-[var(--color-ink)]">{t("systemStatus")}</h3>
            </div>
            <span className="text-[10px] text-slate-500 dark:text-slate-400 font-mono tracking-wide uppercase">
              Host OS: {systemMetrics.os.platform}
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Process Memory Column */}
            <div className="lg:col-span-2 space-y-3">
              <h4 className="text-xs font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider font-mono">
                {t("process")} Telemetry
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {renderProcessInfo('nextjs-server', 'Next.js Web Server', 2048)}
                {renderProcessInfo('crawler-worker', 'GitHub Worker (Merged)', 512)}
                {renderProcessInfo('hf-worker', 'HuggingFace Worker (Merged)', 512)}
                {renderProcessInfo('scheduler-worker', 'Scheduler Worker', 512)}
              </div>
            </div>

            {/* Operating System Stats */}
            <div className="p-4 rounded-xl bg-slate-50/50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-850 flex flex-col justify-between">
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-[var(--color-ink-muted-80)] uppercase tracking-wider font-mono">
                  OS Telemetry
                </h4>
                
                <div className="space-y-3 text-xs">
                  {/* Load Average */}
                  <div className="flex justify-between">
                    <span className="text-[var(--color-ink-muted-80)]">{t("systemLoad")}</span>
                    <span className="font-mono font-semibold text-[var(--color-ink)]">
                      {systemMetrics.os.loadAvg.map(l => l.toFixed(2)).join(" · ")}
                    </span>
                  </div>

                  {/* System RAM */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[var(--color-ink-muted-80)]">
                      <span>{t("freeOSMemory")}</span>
                      <span className="font-mono font-semibold text-[var(--color-ink)]">
                        {formatGB(systemMetrics.os.freeMem)} / {formatGB(systemMetrics.os.totalMem)}
                      </span>
                    </div>
                    {/* OS RAM progress bar */}
                    {(() => {
                      const freePct = Math.round((systemMetrics.os.freeMem / systemMetrics.os.totalMem) * 100);
                      const usedPct = 100 - freePct;
                      const barColor = usedPct > 80 ? "bg-red-500" : usedPct > 60 ? "bg-orange-500" : "bg-blue-500";
                      return (
                        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div className={`h-full ${barColor}`} style={{ width: `${usedPct}%` }} />
                        </div>
                      );
                    })()}
                  </div>

                  {/* OS Uptime */}
                  <div className="flex justify-between items-center pt-1">
                    <span className="text-[var(--color-ink-muted-80)] flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {t("uptime")}
                    </span>
                    <span className="font-mono font-semibold text-[var(--color-ink)]">
                      {formatUptime(systemMetrics.os.uptime)}
                    </span>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Row 2: Data Staleness & Crawl Errors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Data Staleness Dashboard Card */}
        {staleness && (
          <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-apple-body-strong text-[var(--color-ink)]">{t("dataStaleness")}</h3>
              <p className="text-xs text-[var(--color-ink-muted-48)]">Data freshness distribution of trending repository cache</p>
            </div>
            
            <div className="flex flex-col sm:flex-row items-center gap-6 justify-around min-h-64">
              {/* Pie Chart */}
              <div className="h-48 w-48 relative flex items-center justify-center shrink-0">
                <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie
                      data={stalenessChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={65}
                      paddingAngle={3}
                      dataKey="value"
                    >
                      {stalenessChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                      itemStyle={{ color: "var(--color-ink)" }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center Badge */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-bold font-mono text-emerald-500">{staleness.freshPercent}%</span>
                  <span className="text-[9px] uppercase tracking-wider text-slate-400 font-bold">Fresh</span>
                </div>
              </div>

              {/* Legend with percentages */}
              <div className="space-y-3.5 flex-1 min-w-48 text-xs">
                <div className="p-2.5 rounded-lg bg-emerald-500/[0.03] border border-emerald-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{t("fresh")}</span>
                  </div>
                  <span className="font-mono font-bold text-emerald-500">{staleness.fresh24h} ({staleness.freshPercent}%)</span>
                </div>
                
                <div className="p-2.5 rounded-lg bg-orange-500/[0.03] border border-orange-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-orange-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{t("stale24h")}</span>
                  </div>
                  <span className="font-mono font-bold text-orange-500">{staleness.stale24h} ({staleness.stale24hPercent}%)</span>
                </div>

                <div className="p-2.5 rounded-lg bg-red-500/[0.03] border border-red-500/10 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
                    <span className="font-semibold text-slate-700 dark:text-slate-300">{t("stale48h")}</span>
                  </div>
                  <span className="font-mono font-bold text-red-500">{staleness.stale48h} ({staleness.stale48hPercent}%)</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Crawl Errors telemetry card */}
        {commonErrors && (
          <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between">
            <div className="mb-4">
              <h3 className="text-apple-body-strong text-[var(--color-ink)]">{t("crawlErrors")}</h3>
              <p className="text-xs text-[var(--color-ink-muted-48)]">Top failed reasons recorded inside active BullMQ queues</p>
            </div>

            <div className="min-h-64 flex flex-col justify-center">
              {commonErrors.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-6 text-center text-emerald-500 gap-2">
                  <CheckCircle className="w-12 h-12 stroke-[1.5]" />
                  <div>
                    <h4 className="font-bold text-sm">System Healthy</h4>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">No crawl errors recorded in queues.</p>
                  </div>
                </div>
              ) : (
                <div className="h-60 w-full">
                  <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
                    <BarChart data={commonErrors} layout="vertical" margin={{ left: 15, right: 15, top: 5, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={false} vertical={true} />
                      <XAxis type="number" stroke="var(--color-ink-muted-48)" fontSize={10} tickLine={false} />
                      <YAxis dataKey="name" type="category" stroke="var(--color-ink-muted-48)" fontSize={10} width={130} tickLine={false} />
                      <Tooltip 
                        contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                        labelStyle={{ color: "var(--color-ink)", fontWeight: "bold" }}
                        itemStyle={{ color: "var(--color-ink)" }}
                      />
                      <Bar dataKey="value" name="Occurrences" fill="#EF4444" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}

      </div>

      {/* Row 3: Top Categories & Languages */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Stats BarChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">Top Project Categories</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">Most populated AI/ML categories across platforms</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={categories} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={true} vertical={false} />
                <XAxis type="number" stroke="var(--color-ink-muted-48)" fontSize={11} />
                <YAxis dataKey="name" type="category" stroke="var(--color-ink-muted-48)" fontSize={11} width={120} tickLine={false} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: "bold" }}
                  itemStyle={{ color: "var(--color-ink)" }}
                />
                <Bar dataKey="projectCount" name="Projects" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Top Languages BarChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">Top Programming Languages</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">Language distribution for GitHub repositories</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={languages} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={true} vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-ink-muted-48)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-ink-muted-48)" fontSize={11} />
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: "bold" }}
                  itemStyle={{ color: "var(--color-ink)" }}
                />
                <Bar dataKey="count" name="Repos" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

      {/* Row 4: Source Ratio & README Compression */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Source Ratio PieChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between lg:col-span-1">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">Source Distribution</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">GitHub vs HuggingFace project ratios</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="45%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={4}
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip 
                  contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                  itemStyle={{ color: "var(--color-ink)" }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" iconSize={10} iconType="circle" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* README Storage Compression BarChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between lg:col-span-2">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">README Compression Ratio</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">Space saved by Gzip binary storage of READMEs</p>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <BarChart data={compressionChartData} margin={{ left: 10, right: 10, top: 10, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={true} vertical={false} />
                <XAxis dataKey="name" stroke="var(--color-ink-muted-48)" fontSize={11} tickLine={false} />
                <YAxis stroke="var(--color-ink-muted-48)" fontSize={11} tickFormatter={(v) => formatBytes(v)} />
                <Tooltip 
                  formatter={(value: string | number | undefined | readonly (string | number)[]) => {
                    const numValue = Array.isArray(value) ? Number(value[0] || 0) : Number(value || 0);
                    return [formatBytes(numValue), "Size"];
                  }}
                  contentStyle={{ backgroundColor: "var(--color-bg-secondary)", borderColor: "var(--color-divider-soft)", borderRadius: "8px" }}
                  labelStyle={{ color: "var(--color-ink)", fontWeight: "bold" }}
                  itemStyle={{ color: "var(--color-ink)" }}
                />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {compressionChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>

    </div>
  );
}
