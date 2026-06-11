import { Github } from "lucide-react";
import { Link } from "@/i18n/routing";

export function Footer() {
  return (
    <footer className="border-t border-[var(--color-divider-soft)] py-8 mt-16 bg-[var(--color-canvas-parchment)]">
      <div className="page-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-ink-muted-48)]">
          <div className="flex items-center gap-2">
            <span>© 2026 Tinix Repo Trending</span>
            <span className="text-[var(--color-ink-muted-80)]">·</span>
            <span>Open Source Project Tracker</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/tinix-ai/tinix-repo-trending"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-ink)]"
            >
              <Github className="h-3.5 w-3.5" />
              Source
            </a>
            <Link href="/submit" className="transition-colors hover:text-[var(--color-ink)]">Submit Project</Link>
            <Link href="/admin" className="transition-colors hover:text-[var(--color-ink)]">Admin</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
