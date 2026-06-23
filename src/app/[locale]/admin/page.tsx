import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Server, Database, Layers } from "lucide-react";
import { fetchCrawlerReport, fetchAnalyticsData, fetchCategories, fetchDatabaseGrowthStats } from "@/app/actions";
import { DBGrowthChart } from "@/components/admin/db-growth-chart";
import { CategoriesManager } from "@/components/admin/categories-manager";
import { QueueControlPanel } from "@/components/admin/queue-control-panel";
import { RecentJobsTable } from "@/components/admin/recent-jobs-table";
import { CrawlerReport } from "@/components/admin/crawler-report";
import { CrawlerStatusTable } from "@/components/admin/crawler-status-table";
import { ScheduledJobsTable } from "@/components/admin/scheduled-jobs-table";
import { AnalyticsDashboard } from "@/components/admin/analytics-dashboard";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

interface AdminPageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminPage(props: AdminPageProps) {
  const searchParams = await props.searchParams;
  const tab = searchParams.tab || 'overview';
  const currentTab = ['overview', 'queues', 'analytics', 'categories'].includes(tab) ? tab : 'overview';
  
  const [{ count: totalProjects }] = await db.select({ count: sql`count(*)` }).from(projects);
  const [{ count: totalModels }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'model'`);
  const [{ count: totalRepos }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'repository'`);
  const report = await fetchCrawlerReport();
  const growthStats = await fetchDatabaseGrowthStats();
  const t = await getTranslations("Admin");
  
  let analyticsData = null;
  if (currentTab === 'analytics') {
    analyticsData = await fetchAnalyticsData();
  }

  let categoriesData: { id: string; icon: string; color: string; keywords: string[]; createdAt: Date; updatedAt: Date; }[] = [];
  if (currentTab === 'categories') {
    const res = await fetchCategories();
    if (res.success) {
      categoriesData = res.categories;
    }
  }
  
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-apple-display-lg text-[var(--color-ink)] tracking-tight">{t("dashboard")}</h1>
        <p className="text-apple-body text-[var(--color-ink-muted-80)] mt-2">{t("desc")}</p>
      </header>
      
      {/* Tabs Navigation */}
      <div className="flex items-center gap-1 p-1 bg-[var(--color-surface-tile-1)] rounded-xl w-fit border border-[var(--color-divider-soft)]">
        <Link
          href="/admin?tab=overview"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'overview' ? 'bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'}`}
        >
          {t("tabOverview")}
        </Link>
        <Link
          href="/admin?tab=analytics"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'analytics' ? 'bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'}`}
        >
          {t("tabAnalytics")}
        </Link>
        <Link
          href="/admin?tab=queues"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'queues' ? 'bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'}`}
        >
          {t("tabQueues")}
        </Link>
        <Link
          href="/admin?tab=categories"
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentTab === 'categories' ? 'bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm' : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'}`}
        >
          {t("tabCategories")}
        </Link>
      </div>

      <div className="pt-2">
        {currentTab === 'overview' && (
          <div className="space-y-12 animate-fade-in-up">
            <section id="overview">
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("dbStats")}</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="apple-utility-card flex flex-col justify-between">
                  <div>
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                        <Database className="w-5 h-5" />
                      </div>
                      <div className="text-apple-body-strong">{t("totalItems")}</div>
                    </div>
                    <div className="text-apple-display-lg">{Number(totalProjects).toLocaleString()}</div>
                  </div>
                  <DBGrowthChart data={growthStats} />
                </div>
                <div className="apple-utility-card flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                      <Layers className="w-5 h-5" />
                    </div>
                    <div className="text-apple-body-strong">{t("repos")}</div>
                  </div>
                  <div className="text-apple-display-lg">{Number(totalRepos).toLocaleString()}</div>
                </div>
                <div className="apple-utility-card flex flex-col">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                      <Server className="w-5 h-5" />
                    </div>
                    <div className="text-apple-body-strong">{t("models")}</div>
                  </div>
                  <div className="text-apple-display-lg">{Number(totalModels).toLocaleString()}</div>
                </div>
              </div>
            </section>

            <section>
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("collectionReport")}</h2>
              <CrawlerReport report={report} />
            </section>

            <section id="crawlers">
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("crawlerStatus")}</h2>
              <CrawlerStatusTable />
            </section>
          </div>
        )}

        {currentTab === 'queues' && (
          <div className="space-y-12 animate-fade-in-up">
            <section id="settings">
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("queueManagement")}</h2>
              <QueueControlPanel />
            </section>

            <section>
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("scheduledTasks")}</h2>
              <ScheduledJobsTable />
            </section>

            <section>
              <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">{t("recentJobs")}</h2>
              <RecentJobsTable />
            </section>
          </div>
        )}

        {currentTab === 'analytics' && analyticsData && (
          <AnalyticsDashboard analyticsData={analyticsData} report={report} />
        )}

        {currentTab === 'categories' && (
          <div className="space-y-6 animate-fade-in-up">
            <CategoriesManager initialCategories={categoriesData} />
          </div>
        )}
      </div>
    </div>
  );
}
