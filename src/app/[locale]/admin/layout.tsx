import Link from "next/link";
import { Settings, Database, Activity } from "lucide-react";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Sub-nav Frosted */}
      <div className="sticky top-16 z-40 w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
        <div className="page-container h-12 flex items-center gap-6 text-[13px] font-medium text-[var(--color-ink-muted-80)]">
          <Link href="/admin" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Activity className="w-4 h-4" /> Overview
          </Link>
          <Link href="/admin/crawlers" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
            <Database className="w-4 h-4" /> Crawlers
          </Link>
          <Link href="/admin/settings" className="hover:text-[var(--color-ink)] flex items-center gap-1.5 transition-colors">
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
