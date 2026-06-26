"use client";

import { Link, useRouter, usePathname } from "@/i18n/routing";
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
  MessageSquare,
  FolderHeart,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";
import { LanguageSwitcher } from "./language-switcher";

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchFocused, setSearchFocused] = useState(false);
  const t = useTranslations("Navigation");
  const router = useRouter();
  const pathname = usePathname();
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [showSearch, setShowSearch] = useState(true);

  useEffect(() => {
    const isHome = pathname === "/" || pathname === "/en" || pathname === "/vi";
    if (!isHome) {
      Promise.resolve().then(() => setShowSearch(true));
      return;
    }

    const handleScroll = () => {
      if (window.scrollY > 250) {
        setShowSearch(true);
      } else {
        setShowSearch(false);
      }
    };

    Promise.resolve().then(() => handleScroll());
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

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

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/" || pathname === "/en" || pathname === "/vi";
    return pathname.startsWith(href);
  };

  const NAV_ITEMS = [
    { href: "/", label: t("trending"), icon: Flame },
    { href: "/collection", label: t("collections"), icon: FolderHeart },
    { href: "/live-mentions", label: t("liveMentions"), icon: MessageSquare },
    { href: "/categories", label: t("categories"), icon: Hash },
    { href: "/stats", label: t("stats"), icon: BarChart3 },
    { href: "/submit", label: t("submit"), icon: Plus },
    { href: "/admin", label: t("admin"), icon: Settings },
  ];

  return (
    <header className="sticky top-0 z-50 border-b border-[var(--color-divider-soft)] bg-[var(--color-surface-chip-translucent)] backdrop-blur-xl">
      <div className="page-container">
        <div className="flex h-12 items-center gap-3">
          {/* Logo */}
          <Link
            href="/"
            className="group flex shrink-0 items-center gap-2"
          >
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg border border-blue-500/20 bg-blue-500/5">
              <TrendingUp className="h-3.5 w-3.5 text-[var(--color-action-blue)] transition-transform group-hover:scale-110" />
              <div className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-[var(--color-action-blue)] animate-pulse" />
            </div>
            <div className="flex flex-col leading-none">
              <span className="text-[13px] font-semibold tracking-tight text-[var(--color-ink)]">
                Tinix
              </span>
              <span className="text-[9px] font-medium tracking-[0.06em] text-[var(--color-ink-muted-48)] uppercase">
                Repo Trending
              </span>
            </div>
          </Link>

          {/* Search Bar — compact */}
          <form
            onSubmit={handleSearch}
            className={`relative flex-1 max-w-md mx-auto hidden sm:block transition-all duration-300 ${
              showSearch
                ? "opacity-100 translate-y-0 pointer-events-auto"
                : "opacity-0 -translate-y-1 pointer-events-none"
            }`}
          >
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-muted-48)]" />
            <input
              ref={searchInputRef}
              type="search"
              name="q"
              placeholder={t("searchPlaceholder")}
              className={`w-full h-8 rounded-lg border bg-[var(--color-canvas)] pl-8 pr-14 text-[12px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none transition-all duration-200 ${
                searchFocused
                  ? "border-[var(--color-action-blue)] ring-1 ring-[var(--color-action-blue)]"
                  : "border-[var(--color-hairline)] hover:border-[var(--color-border-hover)]"
              }`}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 hidden lg:inline-flex h-4 items-center gap-0.5 rounded border border-[var(--color-divider-soft)] bg-[var(--color-canvas-parchment)] px-1 font-mono text-[9px] text-[var(--color-ink-muted-48)]">
              ⌘K
            </kbd>
          </form>

          {/* Desktop Nav — compact pill links */}
          <nav className="hidden lg:flex items-center gap-0.5">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[12px] font-medium transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "text-[var(--color-ink)] bg-[var(--color-bg-secondary)]"
                      : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-secondary)]/60"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-0.5 shrink-0">
            <LanguageSwitcher />
            <ThemeToggle />

            {/* GitHub link */}
            <a
              href="https://github.com/tinix-ai/tinix-repo-trending"
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-ink-muted-48)] transition-all hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-secondary)]"
              aria-label="GitHub repository"
            >
              <Github className="h-3.5 w-3.5" />
            </a>
          </div>

          {/* Mobile menu button */}
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="lg:hidden flex items-center justify-center h-8 w-8 rounded-lg text-[var(--color-ink-muted-80)] cursor-pointer"
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>

        {/* Mobile nav */}
        {mobileOpen && (
          <nav className="lg:hidden border-t border-[var(--color-divider-soft)] py-2 animate-fade-in-up">
            {/* Mobile search */}
            <form onSubmit={handleSearch} className="relative mb-2 px-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-muted-48)]" />
              <input
                type="search"
                name="q"
                placeholder={t("searchPlaceholder")}
                className="w-full h-9 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] pl-9 pr-4 text-[12px] text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none"
              />
            </form>
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={`flex items-center gap-2 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                    active
                      ? "text-[var(--color-ink)] bg-[var(--color-bg-secondary)]"
                      : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-bg-secondary)]/60"
                  }`}
                >
                  {item.icon && <item.icon className="h-3.5 w-3.5" />}
                  {item.label}
                </Link>
              );
            })}
            <div className="flex items-center justify-between px-3 py-2 mt-1 border-t border-[var(--color-divider-soft)]">
               <LanguageSwitcher />
               <ThemeToggle />
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
