import { Github } from "lucide-react";
import { Link } from "@/i18n/routing";
import { getTranslations } from "next-intl/server";

import { getSession } from "@/lib/auth";

export async function Footer() {
  const t = await getTranslations("Navigation");
  const session = await getSession();

  return (
    <footer className="border-t border-[var(--color-divider-soft)] py-8 mt-16 bg-[var(--color-canvas-parchment)]">
      <div className="page-container">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[var(--color-ink-muted-48)]">
          <div className="flex items-center gap-2">
            <span>© 2026 TiniX Repo Trending</span>
            <span className="text-[var(--color-ink-muted-80)]">·</span>
            <span>{t("tracker")}</span>
          </div>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/tinix-ai/tinix-repo-trending"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 transition-colors hover:text-[var(--color-ink)]"
            >
              <Github className="h-3.5 w-3.5" />
              {t("source")}
            </a>
            <Link href="/submit" className="transition-colors hover:text-[var(--color-ink)]">{t("submit")}</Link>
            {session?.role === "admin" && (
              <Link href="/admin" className="transition-colors hover:text-[var(--color-ink)]">{t("admin")}</Link>
            )}
          </div>
        </div>
      </div>
    </footer>
  );
}
