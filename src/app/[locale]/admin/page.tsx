import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Server, Database, Layers } from "lucide-react";
import { fetchCrawlerReport } from "@/app/actions";
import { QueueControlPanel } from "@/components/admin/queue-control-panel";
import { RecentJobsTable } from "@/components/admin/recent-jobs-table";
import { CrawlerReport } from "@/components/admin/crawler-report";
import { CrawlerStatusTable } from "@/components/admin/crawler-status-table";

export default async function AdminPage() {
  const [{ count: totalProjects }] = await db.select({ count: sql`count(*)` }).from(projects);
  const [{ count: totalModels }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'model'`);
  const [{ count: totalRepos }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'repository'`);
  const report = await fetchCrawlerReport();
  
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-apple-display-lg text-[var(--color-ink)] tracking-tight">Dashboard</h1>
        <p className="text-apple-body text-[var(--color-ink-muted-80)] mt-2">System overview, crawler management and collection reporting.</p>
      </header>
      
      {/* Section 1: Database Statistics */}
      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Database Statistics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="apple-utility-card flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                <Database className="w-5 h-5" />
              </div>
              <div className="text-apple-body-strong">Total Items</div>
            </div>
            <div className="text-apple-display-lg">{Number(totalProjects).toLocaleString()}</div>
          </div>
          <div className="apple-utility-card flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-apple-body-strong">Repositories</div>
            </div>
            <div className="text-apple-display-lg">{Number(totalRepos).toLocaleString()}</div>
          </div>
          <div className="apple-utility-card flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-cyan-500/10 flex items-center justify-center text-cyan-500">
                <Server className="w-5 h-5" />
              </div>
              <div className="text-apple-body-strong">AI Models</div>
            </div>
            <div className="text-apple-display-lg">{Number(totalModels).toLocaleString()}</div>
          </div>
        </div>
      </section>

      {/* Section 2: Crawler Report */}
      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Collection Report</h2>
        <CrawlerReport report={report} />
      </section>

      {/* Section 3: Project Crawler Status */}
      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Project Crawler Status</h2>
        <CrawlerStatusTable />
      </section>

      {/* Section 4: Queue Control Panel */}
      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Queue Management</h2>
        <QueueControlPanel />
      </section>

      {/* Section 4: Recent Jobs */}
      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Recent Jobs</h2>
        <RecentJobsTable />
      </section>
    </div>
  );
}
