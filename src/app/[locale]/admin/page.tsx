import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { Server, Database, Layers } from "lucide-react";
import { RunCrawlerButton } from "@/components/admin/run-crawler-button";

export default async function AdminPage() {
  const [{ count: totalProjects }] = await db.select({ count: sql`count(*)` }).from(projects);
  const [{ count: totalModels }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'model'`);
  const [{ count: totalRepos }] = await db.select({ count: sql`count(*)` }).from(projects).where(sql`${projects.projectType} = 'repository'`);
  
  return (
    <div className="space-y-12">
      <header>
        <h1 className="text-apple-display-lg text-[var(--color-ink)] tracking-tight">Dashboard</h1>
        <p className="text-apple-body text-[var(--color-ink-muted-80)] mt-2">System overview and crawler management.</p>
      </header>
      
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
              <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-500">
                <Server className="w-5 h-5" />
              </div>
              <div className="text-apple-body-strong">AI Models</div>
            </div>
            <div className="text-apple-display-lg">{Number(totalModels).toLocaleString()}</div>
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-apple-body-strong text-[var(--color-ink)] mb-4">Crawler Jobs</h2>
        <div className="apple-utility-card">
          <div className="flex items-center justify-between py-4 border-b border-[var(--color-divider-soft)] first:pt-0 last:border-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <div className="text-apple-body-strong">GitHub Sync</div>
                <div className="text-apple-caption text-[var(--color-ink-muted-80)]">Scheduled daily at 00:00 UTC</div>
              </div>
            </div>
            <RunCrawlerButton source="github" />
          </div>
          <div className="flex items-center justify-between py-4 border-b border-[var(--color-divider-soft)] first:pt-0 last:border-0 last:pb-0">
            <div className="flex items-center gap-4">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
              <div>
                <div className="text-apple-body-strong">HuggingFace Sync</div>
                <div className="text-apple-caption text-[var(--color-ink-muted-80)]">Scheduled daily at 00:30 UTC</div>
              </div>
            </div>
            <RunCrawlerButton source="huggingface" />
          </div>
        </div>
      </section>
    </div>
  );
}
