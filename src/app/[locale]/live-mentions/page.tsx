import React from 'react';
import { fetchPaginatedMentions } from '@/app/actions';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { formatNumber } from '@/lib/utils';
import { 
  ArrowLeft, 
  ExternalLink, 
  MessageSquare,
  MessageCircle,
  TrendingUp,
  User,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Flame,
  ChevronsLeft,
  ChevronsRight,
} from 'lucide-react';
import { SourceBadge } from '@/components/common/source-badge';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'SocialListening' });
  return {
    title: t('title'),
    description: t('description'),
  };
}

interface PageProps {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ 
    source?: string; 
    page?: string; 
    search?: string; 
    sort?: string;
  }>;
}

export default async function LiveMentionsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const { locale } = resolvedParams;
  const sp = await searchParams;
  
  const activeSource = sp.source || 'all';
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));
  const searchQuery = sp.search || '';
  const sortBy = (sp.sort || 'newest') as 'newest' | 'oldest' | 'score' | 'comments';
  const perPage = 20;

  const t = await getTranslations({ locale, namespace: 'SocialListening' });
  const tNav = await getTranslations({ locale, namespace: 'Navigation' });

  const result = await fetchPaginatedMentions({
    page: currentPage,
    perPage,
    source: activeSource,
    search: searchQuery,
    sort: sortBy,
  });

  const { data: mentions, total, totalPages } = result;

  const sourceOptions = [
    { key: 'all', label: t('allSources') },
    { key: 'reddit', label: t('redditSource') },
    { key: 'x', label: t('xSource') },
    { key: 'hacker_news', label: t('hnSource') }
  ];

  const sortOptions = [
    { key: 'newest', label: 'Newest', icon: Clock },
    { key: 'oldest', label: 'Oldest', icon: Clock },
    { key: 'score', label: 'Top Score', icon: Flame },
    { key: 'comments', label: 'Most Discussed', icon: MessageCircle },
  ];

  // Helper to build URLs preserving all query params
  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string> = {};
    if (activeSource !== 'all') merged.source = activeSource;
    if (searchQuery) merged.search = searchQuery;
    if (sortBy !== 'newest') merged.sort = sortBy;
    // Apply overrides
    for (const [k, v] of Object.entries(overrides)) {
      if (v === undefined || v === '' || (k === 'source' && v === 'all') || (k === 'sort' && v === 'newest') || (k === 'page' && v === '1')) {
        delete merged[k];
      } else {
        merged[k] = v;
      }
    }
    const qs = new URLSearchParams(merged).toString();
    return `/live-mentions${qs ? `?${qs}` : ''}`;
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'reddit':
        return <span className="text-orange-500 font-bold text-[10px] uppercase bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full select-none">Reddit</span>;
      case 'x':
        return <span className="text-[var(--color-ink)] font-bold text-[10px] bg-[var(--color-ink)]/5 border border-[var(--color-ink)]/10 px-2 py-0.5 rounded-full select-none">X</span>;
      case 'hacker_news':
        return <span className="text-amber-600 font-bold text-[10px] uppercase bg-amber-600/10 border border-amber-600/20 px-2 py-0.5 rounded-full select-none">HN</span>;
      default:
        return null;
    }
  };

  const formatDate = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diffDay > 365 ? 'numeric' : undefined });
  };

  const formatFullDate = (date: Date | string) => {
    const d = new Date(date);
    return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  // Pagination helpers
  const buildPageNumbers = () => {
    const pages: (number | 'dots')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('dots');
      for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
        pages.push(i);
      }
      if (currentPage < totalPages - 2) pages.push('dots');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      {/* Hero Header */}
      <section className="apple-tile-light w-full py-8 lg:py-10 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="flex flex-col gap-5">
            
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider-soft)] pb-4 mb-1">
              <Link 
                href="/" 
                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 hover:bg-[var(--color-canvas)] transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                {tNav("trending")}
              </Link>
              <div className="h-4 w-px bg-[var(--color-border)] mx-1" />
              <span className="text-[11px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-80)]">
                {t('header')}
              </span>
            </div>

            {/* Title */}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)]">
                  {t('header')}
                </h1>
                <span className="relative flex h-2.5 w-2.5 select-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
                </span>
              </div>
              <div className="text-xs text-[var(--color-ink-muted-48)] font-medium tabular-nums">
                {total.toLocaleString()} mentions found
              </div>
            </div>

            <p className="text-sm text-[var(--color-ink-muted-80)] max-w-3xl leading-relaxed">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Toolbar + Feed */}
      <section className="apple-tile-parchment w-full py-8 min-h-[60vh]">
        <div className="page-container max-w-5xl">
          
          {/* ── Toolbar ── */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            
            {/* Left: Source Filter */}
            <div className="flex flex-wrap items-center gap-1.5">
              {sourceOptions.map(opt => {
                const isActive = activeSource === opt.key;
                return (
                  <Link
                    key={opt.key}
                    href={buildUrl({ source: opt.key, page: '1' })}
                    className={`inline-flex h-8 items-center rounded-full px-3.5 text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 ${
                      isActive 
                        ? 'bg-[var(--color-action-blue)] text-white shadow-sm'
                        : 'border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)]'
                    }`}
                  >
                    {opt.label}
                  </Link>
                );
              })}
            </div>

            {/* Right: Search + Sort */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              {/* Search */}
              <form method="GET" action={`/${locale}/live-mentions`} className="relative flex-1 sm:w-56">
                <input type="hidden" name="source" value={activeSource} />
                <input type="hidden" name="sort" value={sortBy} />
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-muted-48)]" />
                <input
                  type="text"
                  name="search"
                  defaultValue={searchQuery}
                  placeholder="Search mentions…"
                  className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]/20 transition-all placeholder:text-[var(--color-ink-muted-48)]"
                />
              </form>
              
              {/* Sort */}
              <div className="flex items-center gap-0.5 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-0.5">
                {sortOptions.map(opt => {
                  const isActive = sortBy === opt.key;
                  const Icon = opt.icon;
                  return (
                    <Link
                      key={opt.key}
                      href={buildUrl({ sort: opt.key, page: '1' })}
                      title={opt.label}
                      className={`inline-flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                        isActive
                          ? 'bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)]'
                          : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'
                      }`}
                    >
                      <Icon className="h-3 w-3" />
                      <span className="hidden sm:inline">{opt.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Active search indicator */}
          {searchQuery && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-[var(--color-action-blue)]/5 border border-[var(--color-action-blue)]/15 rounded-lg">
              <Search className="h-3 w-3 text-[var(--color-action-blue)]" />
              <span className="text-xs text-[var(--color-ink-muted-80)]">
                Search results for <strong className="text-[var(--color-ink)]">&ldquo;{searchQuery}&rdquo;</strong>
              </span>
              <Link
                href={buildUrl({ search: undefined, page: '1' })}
                className="ml-auto text-[10px] font-semibold text-[var(--color-action-blue)] hover:underline"
              >
                Clear
              </Link>
            </div>
          )}

          {/* ── Feed ── */}
          {mentions.length > 0 ? (
            <>
              <div className="space-y-3">
                {mentions.map((mention) => {
                  const projectDetailUrl = `/project/${mention.projectSlug.replace(/\//g, '-')}-${mention.projectId}`;
                  return (
                    <div 
                      key={mention.id}
                      className="group apple-utility-card hover-spring p-0 overflow-hidden"
                    >
                      <div className="flex flex-col sm:flex-row">
                        {/* Left: Score indicator */}
                        <div className="hidden sm:flex flex-col items-center justify-center gap-0.5 w-16 shrink-0 border-r border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)]/40 py-4">
                          <TrendingUp className="h-3.5 w-3.5 text-[var(--color-action-blue)]" />
                          <span className="text-sm font-bold tabular-nums text-[var(--color-ink)]">{formatNumber(mention.score)}</span>
                          <span className="text-[9px] text-[var(--color-ink-muted-48)] uppercase tracking-wider">score</span>
                        </div>

                        {/* Main content */}
                        <div className="flex-1 p-4 sm:p-5 min-w-0">
                          {/* Top row: Project + Source + Time */}
                          <div className="flex items-start justify-between gap-3 mb-2.5">
                            <div className="flex items-center gap-2 min-w-0 flex-wrap">
                              <Link 
                                href={projectDetailUrl}
                                className="font-bold text-[13px] text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate"
                              >
                                {mention.projectFullName}
                              </Link>
                              <SourceBadge source={mention.projectSource} size="sm" />
                              {getSourceIcon(mention.source)}
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0" title={formatFullDate(mention.mentionedAt)}>
                              <Clock className="h-3 w-3 text-[var(--color-ink-muted-48)]" />
                              <span className="text-[11px] text-[var(--color-ink-muted-48)] font-medium tabular-nums whitespace-nowrap">
                                {formatDate(mention.mentionedAt)}
                              </span>
                            </div>
                          </div>

                          {/* Content */}
                          <p className="text-[13px] text-[var(--color-ink-muted-80)] leading-relaxed whitespace-pre-wrap line-clamp-3 break-words mb-3">
                            {mention.content}
                          </p>

                          {/* Footer: Author + Metrics + Link */}
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <User className="h-3 w-3 text-[var(--color-ink-muted-48)] shrink-0" />
                              <span className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] truncate max-w-[140px]">
                                {mention.author.split('/').pop()}
                              </span>
                            </div>

                            <div className="flex items-center gap-3 text-[11px] font-semibold tabular-nums text-[var(--color-ink-muted-80)]">
                              {/* Mobile score */}
                              <span className="flex sm:hidden items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-[var(--color-action-blue)]" />
                                {formatNumber(mention.score)}
                              </span>
                              <span className="flex items-center gap-1" title={`${mention.commentsCount} comments`}>
                                <MessageCircle className="h-3 w-3 text-zinc-500" />
                                {formatNumber(mention.commentsCount)}
                              </span>
                              <a 
                                href={mention.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline"
                                title="View original"
                              >
                                <ExternalLink className="h-3 w-3" />
                                <span className="hidden sm:inline text-[10px]">View</span>
                              </a>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between mt-8 pt-6 border-t border-[var(--color-divider-soft)]">
                  {/* Info */}
                  <div className="text-xs text-[var(--color-ink-muted-48)]">
                    Page <span className="font-semibold text-[var(--color-ink-muted-80)]">{currentPage}</span> of{' '}
                    <span className="font-semibold text-[var(--color-ink-muted-80)]">{totalPages}</span>
                    <span className="mx-2 text-[var(--color-border)]">·</span>
                    {total.toLocaleString()} total
                  </div>

                  {/* Page buttons */}
                  <div className="flex items-center gap-1">
                    {/* First */}
                    {currentPage > 2 && (
                      <Link
                        href={buildUrl({ page: '1' })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)] transition-all"
                        title="First page"
                      >
                        <ChevronsLeft className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    {/* Prev */}
                    {currentPage > 1 && (
                      <Link
                        href={buildUrl({ page: String(currentPage - 1) })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)] transition-all"
                        title="Previous page"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    {/* Number pages */}
                    {buildPageNumbers().map((p, i) =>
                      p === 'dots' ? (
                        <span key={`dots-${i}`} className="w-8 h-8 flex items-center justify-center text-xs text-[var(--color-ink-muted-48)]">…</span>
                      ) : (
                        <Link
                          key={p}
                          href={buildUrl({ page: String(p) })}
                          className={`w-8 h-8 flex items-center justify-center rounded-lg text-xs font-semibold transition-all ${
                            p === currentPage
                              ? 'bg-[var(--color-action-blue)] text-white shadow-sm'
                              : 'border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)]'
                          }`}
                        >
                          {p}
                        </Link>
                      )
                    )}

                    {/* Next */}
                    {currentPage < totalPages && (
                      <Link
                        href={buildUrl({ page: String(currentPage + 1) })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)] transition-all"
                        title="Next page"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Link>
                    )}

                    {/* Last */}
                    {currentPage < totalPages - 1 && (
                      <Link
                        href={buildUrl({ page: String(totalPages) })}
                        className="w-8 h-8 flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] hover:border-[var(--color-border-hover)] transition-all"
                        title="Last page"
                      >
                        <ChevronsRight className="h-3.5 w-3.5" />
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="apple-utility-card p-12 text-center flex flex-col items-center justify-center border-dashed">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-[var(--color-ink-muted-48)]" />
              </div>
              <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">{t("noMentions")}</h3>
              <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                {searchQuery ? `No results for "${searchQuery}". Try a different search term.` : t("noMentionsDesc")}
              </p>
              {searchQuery && (
                <Link
                  href={buildUrl({ search: undefined, page: '1' })}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[var(--color-action-blue)] border border-[var(--color-action-blue)]/30 rounded-lg hover:bg-[var(--color-action-blue)]/5 transition-all"
                >
                  Clear search
                </Link>
              )}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
