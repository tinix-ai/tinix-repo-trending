import { Link } from "@/i18n/routing";
import { Activity, Database, BarChart2, Link2, Settings } from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin?tab=overview", label: "Overview", icon: Activity },
  { href: "/admin?tab=overview#crawlers", label: "Crawlers", icon: Database },
  { href: "/admin?tab=analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/share-analytics", label: "Share Links", icon: Link2 },
  { href: "/admin?tab=queues", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Sub-nav — synced with header style */}
      <div className="sticky top-12 z-40 w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
        <div className="page-container">
          <nav className="flex items-center gap-0.5 h-10 overflow-x-auto hide-scrollbar">
            {ADMIN_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[12px] font-medium text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-secondary)]/60 transition-colors whitespace-nowrap cursor-pointer"
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>

      <main className="page-container py-10">
        {children}
      </main>
    </div>
  );
}
