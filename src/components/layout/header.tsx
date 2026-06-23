"use client";

import { Link, useRouter } from "@/i18n/routing";
import { useState, FormEvent, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import {
  Search,
  Flame,
  Hash,
  BarChart3,
  Plus,
  Menu,
  X,
  TrendingUp,
  Github,
  Settings,
  MessageSquare
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const t = useTranslations("Navigation");
  const router = useRouter();
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get("q") as string;
    if (q) {
      router.push(`/?q=${encodeURIComponent(q)}`);
    } else {
      router.push("/");
    }
  };

  const NAV_ITEMS = [
    { href: "/", label: t("trending"), icon: Flame },
    { href: "/live-mentions", label: t("liveMentions"), icon: MessageSquare },
    { href: "/categories", label: t("categories"), icon: Hash },
    { href: "/stats", label: t("stats"), icon: BarChart3 },
    { href: "/submit", label: t("submit"), icon: Plus },
    { href: "/admin", label: t("admin"), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
      <div className="page-container">
        <div className="flex h-14 items-center gap-4">
          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2.5"
          >
            <div className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/5 shadow-[0_0_16px_rgba(0,102,204,0.08)]">
              <TrendingUp className="h-[16px] w-[16px] text-[var(--color-action-blue)] transition-transform group-hover:scale-110" />
              <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--color-action-blue)] animate-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
                Tinix
              </span>
              <span className="text-[10px] font-medium tracking-[0.08em] text-[var(--color-ink-muted-80)] uppercase">
                Repo Trending
              </span>
            </div>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="relative flex-1 max-w-xl mx-auto hidden sm:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-muted-48)]" />
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              className={`w-full h-9 rounded-lg border bg-[var(--color-canvas)] pl-10 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none transition-all duration-200 ${
                searchFocused
                  ? "border-[var(--color-action-blue)] ring-1 ring-[var(--color-action-blue)]"
                  : "border-[var(--color-hairline)] hover:border-[var(--color-border-hover)]"
              }`}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-5 items-center gap-0.5 rounded border border-[var(--color-divider-soft)] bg-[var(--color-canvas-parchment)] px-1.5 font-mono text-[10px] text-[var(--color-ink-muted-80)]">
              ⌘K
            </kbd>
          </form>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[13px] font-medium text-[var(--color-ink-muted-80)] transition-colors hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="flex items-center gap-1">
            <LanguageSwitcher />
            <ThemeToggle />
            
            {/* GitHub link */}
            <a
              href="https://github.com/tinix-ai/tinix-repo-trending"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center justify-center h-9 w-9 rounded-lg text-[var(--color-ink-muted-80)] transition-all hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
              aria-label="GitHub repository"
            >
              <Github className="h-4 w-4" />
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg text-[var(--color-ink-muted-80)]"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="md:hidden border-t border-[var(--color-divider-soft)] py-3 animate-fade-in-up">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="relative mb-3">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--color-ink-muted-48)]" />
              <input
                type="search"
                name="q"
                placeholder={t("searchPlaceholder")}
                className="w-full h-10 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-10 pr-4 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none"
              />
            </form>
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-[var(--color-ink-muted-80)] transition-colors hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
              >
                {item.icon && <item.icon className="h-4 w-4" />}
                {item.label}
              </Link>
            ))}
            {/* Add theme toggle for mobile too */}
            <div className="flex items-center justify-between px-3 py-2 mt-2 border-t border-[var(--color-divider-soft)]">
               <LanguageSwitcher />
               <ThemeToggle />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
