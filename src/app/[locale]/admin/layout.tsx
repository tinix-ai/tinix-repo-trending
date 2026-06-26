import { Link } from "@/i18n/routing";
import { Settings, Database, Activity, BarChart2, Link2 } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Sub-nav Frosted */}
      <div className="sticky top-14 z-40 w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
        <div className="page-container h-12 flex items-center gap-6 text-[13px] font-medium text-[var(--color-ink-muted-80)]">
          <Link href="/admin?tab=overview" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Activity className="w-4 h-4" /> Overview
          </Link>
          <Link href="/admin?tab=overview#crawlers" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Database className="w-4 h-4" /> Crawlers
          </Link>
          <Link href="/admin?tab=analytics" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <BarChart2 className="w-4 h-4" /> Analytics
          </Link>
          <Link href="/admin/share-analytics" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Link2 className="w-4 h-4" /> Share Links
          </Link>
          <Link href="/admin?tab=queues" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Settings className="w-4 h-4" /> Settings
          </Link>
        </div>
      </div>

      <main className="page-container py-12">
        {children}
      </main>
    </div>
  );
}
