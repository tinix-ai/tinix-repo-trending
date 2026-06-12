import { GitBranch, Box, Database as DbIcon, Clock, CalendarDays, TrendingUp } from "lucide-react";
import { useTranslations } from "next-intl";

interface CrawlerReportProps {
  report: {
    githubTotal: number;
    hfModels: number;
    hfDatasets: number;
    crawled24h: number;
    crawled7d: number;
    github24h: number;
    hf24h: number;
    github7d: number;
    hf7d: number;
    totalProjects: number;
  };
}

export function CrawlerReport({ report }: CrawlerReportProps) {
  const t = useTranslations("Admin");
  
  const sources = [
    {
      label: t("githubRepos"),
      icon: GitBranch,
      color: 'text-[var(--color-ink)]',
      bgColor: 'bg-[var(--color-ink)]/5',
      total: report.githubTotal,
      last24h: report.github24h,
      last7d: report.github7d,
    },
    {
      label: t("hfModels"),
      icon: Box,
      color: 'text-cyan-500',
      bgColor: 'bg-cyan-500/10',
      total: report.hfModels,
      last24h: report.hf24h,
      last7d: report.hf7d,
    },
    {
      label: t("hfDatasets"),
      icon: DbIcon,
      color: 'text-amber-500',
      bgColor: 'bg-amber-500/10',
      total: report.hfDatasets,
      last24h: 0,
      last7d: 0,
    },
  ];

  const pctGithub = report.totalProjects > 0 ? (report.githubTotal / report.totalProjects) * 100 : 0;
  const pctHf = report.totalProjects > 0 ? ((report.hfModels + report.hfDatasets) / report.totalProjects) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Summary row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="apple-utility-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--color-ink)] tabular-nums">{report.totalProjects.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-ink-muted-48)]">{t("totalProjects")}</div>
          </div>
        </div>
        <div className="apple-utility-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500 shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--color-ink)] tabular-nums">{report.crawled24h.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-ink-muted-48)]">{t("crawled24h")}</div>
          </div>
        </div>
        <div className="apple-utility-card flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500 shrink-0">
            <CalendarDays className="w-5 h-5" />
          </div>
          <div>
            <div className="text-2xl font-semibold text-[var(--color-ink)] tabular-nums">{report.crawled7d.toLocaleString()}</div>
            <div className="text-xs text-[var(--color-ink-muted-48)]">{t("crawled7d")}</div>
          </div>
        </div>
      </div>

      {/* Source breakdown */}
      <div className="apple-utility-card">
        <h3 className="text-apple-body-strong mb-4">{t("sourceDistribution")}</h3>
        
        {/* Distribution bar */}
        <div className="w-full h-3 rounded-full bg-[var(--color-canvas-parchment)] overflow-hidden flex mb-4">
          <div
            className="h-full bg-[var(--color-ink)] rounded-l-full transition-all duration-500"
            style={{ width: `${pctGithub}%` }}
          />
          <div
            className="h-full bg-cyan-500 transition-all duration-500"
            style={{ width: `${pctHf}%` }}
          />
        </div>

        {/* Legend + detail */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {sources.map(s => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="flex items-start gap-3 p-3 rounded-xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)]">
                <div className={`w-8 h-8 rounded-full ${s.bgColor} flex items-center justify-center ${s.color} shrink-0 mt-0.5`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-medium text-[var(--color-ink)]">{s.label}</div>
                  <div className="text-lg font-semibold text-[var(--color-ink)] tabular-nums">{s.total.toLocaleString()}</div>
                  <div className="text-[10px] text-[var(--color-ink-muted-48)]">
                    24h: {s.last24h} · 7d: {s.last7d}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
