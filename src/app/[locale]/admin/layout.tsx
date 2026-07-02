"use client";

import { Link, usePathname } from "@/i18n/routing";
import { useSearchParams } from "next/navigation";
import { Activity, BarChart2, Link2, Settings, FolderHeart, Layers, Inbox, MessageSquare, Users, Trophy, BookOpen } from "lucide-react";

const ADMIN_NAV = [
  { href: "/admin?tab=overview", label: "Overview", icon: Activity },
  { href: "/admin/collections", label: "Collections", icon: FolderHeart },
  { href: "/admin?tab=analytics", label: "Analytics", icon: BarChart2 },
  { href: "/admin/share-analytics", label: "Share Links", icon: Link2 },
  { href: "/admin?tab=categories", label: "Categories", icon: Layers },
  { href: "/admin?tab=submissions", label: "Submissions", icon: Inbox },
  { href: "/admin?tab=blog", label: "Stories", icon: BookOpen },
  { href: "/admin?tab=reviews", label: "Reviews", icon: MessageSquare },
  { href: "/admin?tab=achievements", label: "Achievements", icon: Trophy },
  { href: "/admin?tab=users", label: "Users", icon: Users },
  { href: "/admin?tab=queues", label: "Settings", icon: Settings },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const isLinkActive = (itemHref: string) => {
    try {
      const url = new URL(itemHref, "http://localhost");
      const itemPath = url.pathname;
      const itemTab = url.searchParams.get("tab");
      
      if (pathname !== itemPath) return false;
      
      const currentTab = searchParams.get("tab");
      if (itemTab) {
        return currentTab === itemTab;
      }
      
      if (pathname === "/admin" && !currentTab) {
        return itemHref === "/admin?tab=overview" || itemHref === "/admin";
      }
      
      return !currentTab;
    } catch {
      return false;
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)]">
      {/* Sub-nav — aligned with global header */}
      <div className="sticky top-[44px] z-40 w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
        <div className="page-container">
          <nav className="flex items-center gap-1.5 h-11 overflow-x-auto hide-scrollbar">
            {ADMIN_NAV.map((item) => {
              const active = isLinkActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[12px] font-medium transition-all whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] text-[var(--color-ink)] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                      : "border border-transparent text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-secondary)]/40"
                  }`}
                >
                  <item.icon className="w-3.5 h-3.5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>

      <main className="page-container py-8">
        {children}
      </main>
    </div>
  );
}
