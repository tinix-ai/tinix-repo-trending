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
import { Database, HardDrive, Percent, CheckCircle } from "lucide-react";

interface AnalyticsDashboardProps {
  analyticsData: {
    success: boolean;
    stats: {
      totalProjects: number;
      projectsWithReadme: number;
      compressedSize: number;
      estimatedRawSize: number;
      savedSize: number;
    };
    categories: Array<{
      name: string;
      projectCount: number;
    }>;
    languages: Array<{
      name: string;
      count: number;
    }>;
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

  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  if (!mounted) {
    return (
      <div className="h-96 flex items-center justify-center text-sm text-[var(--color-ink-muted-48)] font-medium">
        Loading charts...
      </div>
    );
  }

  const { stats, categories, languages } = analyticsData;

  // Format bytes to readable size
  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const compressionPercent = stats.estimatedRawSize > 0 
    ? Math.round((stats.savedSize / stats.estimatedRawSize) * 100) 
    : 0;

  // Data for Github vs HF Pie chart
  const sourceData = [
    { name: "GitHub", value: report.githubTotal, color: "#1e293b" },
    { name: "HF Models", value: report.hfModels, color: "#06b6d4" },
    { name: "HF Datasets", value: report.hfDatasets, color: "#f59e0b" },
  ];

  // Data for compression bar chart
  const compressionChartData = [
    {
      name: "Original Size",
      value: stats.estimatedRawSize,
      color: "#f43f5e"
    },
    {
      name: "Gzipped Storage",
      value: stats.compressedSize,
      color: "#10b981"
    }
  ];

  return (
    <div className="space-y-8 animate-fade-in-up">
      
      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight">
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
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight">
              {formatBytes(stats.compressedSize)}
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              Gzip Compressed
            </div>
          </div>
        </div>

        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-orange-500/10 flex items-center justify-center text-orange-500 shrink-0">
            <CheckCircle className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight">
              {formatBytes(stats.savedSize)}
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              Disk Space Saved
            </div>
          </div>
        </div>

        <div className="apple-utility-card flex items-center gap-4 border border-[var(--color-divider-soft)]">
          <div className="w-12 h-12 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
            <Percent className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xl font-bold text-[var(--color-ink)] tracking-tight">
              {compressionPercent}%
            </div>
            <div className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
              Compression Ratio
            </div>
          </div>
        </div>

      </div>

      {/* Charts Grid - Row 1 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Category Stats BarChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">Top Project Categories</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">Most populated AI/ML categories across platforms</p>
          </div>
          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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

      {/* Charts Grid - Row 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Source Ratio PieChart */}
        <div className="apple-utility-card border border-[var(--color-divider-soft)] flex flex-col justify-between lg:col-span-1">
          <div className="mb-4">
            <h3 className="text-apple-body-strong text-[var(--color-ink)]">Source Distribution</h3>
            <p className="text-xs text-[var(--color-ink-muted-48)]">GitHub vs HuggingFace project ratios</p>
          </div>
          <div className="h-64 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
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
            <ResponsiveContainer width="100%" height="100%">
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
