import React from 'react';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { 
  Clock, 
  Flame, 
  MessageSquare, 
  MessageCircle, 
  Search, 
  Star, 
  User, 
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  TrendingUp
} from 'lucide-react';
import { formatNumber } from '@/lib/utils';
import { UnifiedActivityItem } from '@/lib/db/queries';

export interface CommunityFeedProps {
  locale: string;
  source?: string;
  page?: string;
  search?: string;
  sort?: string;
  data: UnifiedActivityItem[];
  total: number;
  totalPages: number;
}

export function CommunityFeed({
  locale,
  source = 'all',
  page = '1',
  search = '',
  sort = 'newest',
  data,
  total,
  totalPages
}: CommunityFeedProps) {
  const activeSource = source;
  const currentPage = Math.max(1, parseInt(page, 10));
  const searchQuery = search;
  const sortBy = sort as 'newest' | 'popular';

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
    return `/community${qs ? `?${qs}` : ''}`;
  }

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'user':
        return <span className="text-blue-500 font-bold text-[10px] uppercase bg-blue-500/10 border border-blue-500/20 px-2 py-0.5 rounded-full select-none">TiniX Member</span>;
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

  const timeAgo = (date: Date | string) => {
    const d = new Date(date);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffMin < 1) return locale === 'vi' ? 'Vừa xong' : 'Just now';
    if (diffMin < 60) return locale === 'vi' ? `${diffMin} phút trước` : `${diffMin}m ago`;
    if (diffHr < 24) return locale === 'vi' ? `${diffHr} giờ trước` : `${diffHr}h ago`;
    if (diffDay < 7) return locale === 'vi' ? `${diffDay} ngày trước` : `${diffDay}d ago`;
    return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric', year: diffDay > 365 ? 'numeric' : undefined });
  };

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

  const sourceFilters = [
    { key: 'all', label: locale === 'vi' ? 'Tất cả' : 'All' },
    { key: 'user', label: locale === 'vi' ? 'Thành viên' : 'Members' },
    { key: 'x', label: 'Twitter/X' },
    { key: 'reddit', label: 'Reddit' },
    { key: 'hacker_news', label: 'Hacker News' },
  ];

  const sortFilters = [
    { key: 'newest', label: locale === 'vi' ? 'Mới nhất' : 'Newest', icon: Clock },
    { key: 'popular', label: locale === 'vi' ? 'Nổi bật nhất' : 'Popular', icon: Flame },
  ];

  return (
    <div className="w-full">
      {/* Filters Toolbar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 border-b border-[var(--color-divider-soft)] pb-4">
        {/* Left: Source Select */}
        <div className="flex flex-wrap items-center gap-1.5">
          {sourceFilters.map(opt => {
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

        {/* Right: Search & Sort */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search Input */}
          <form method="GET" action={`/${locale}/community`} className="relative w-full sm:w-60">
            <input type="hidden" name="source" value={activeSource} />
            <input type="hidden" name="sort" value={sortBy} />
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--color-ink-muted-48)]" />
            <input
              type="text"
              name="search"
              defaultValue={searchQuery}
              placeholder={locale === 'vi' ? 'Tìm kiếm thảo luận...' : 'Search discussions...'}
              className="w-full pl-8 pr-3 py-2 text-xs bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]/20 transition-all placeholder:text-[var(--color-ink-muted-48)]"
            />
          </form>

          {/* Sort Dropdown */}
          <div className="flex items-center gap-0.5 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg p-0.5 w-full sm:w-auto justify-center">
            {sortFilters.map(opt => {
              const isActive = sortBy === opt.key;
              const Icon = opt.icon;
              return (
                <Link
                  key={opt.key}
                  href={buildUrl({ sort: opt.key, page: '1' })}
                  title={opt.label}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-[10px] font-semibold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)]'
                      : 'text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]'
                  }`}
                >
                  <Icon className="h-3 w-3" />
                  <span>{opt.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Search/Filter info */}
      {(searchQuery || activeSource !== 'all') && (
        <div className="flex items-center justify-between mb-4 text-xs text-[var(--color-ink-muted-64)] bg-[var(--color-canvas-parchment)] p-3 rounded-xl border border-[var(--color-divider-soft)]">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span>{locale === 'vi' ? 'Tìm thấy' : 'Found'} <strong>{total}</strong> {locale === 'vi' ? 'hoạt động' : 'activities'}</span>
            {searchQuery && (
              <>
                <span>•</span>
                <span>{locale === 'vi' ? 'Từ khóa:' : 'Keyword:'} <code className="bg-[var(--color-bg-secondary)] px-1.5 py-0.5 rounded text-[var(--color-ink)]">"{searchQuery}"</code></span>
              </>
            )}
            {activeSource !== 'all' && (
              <>
                <span>•</span>
                <span>{locale === 'vi' ? 'Nguồn:' : 'Source:'} <strong className="capitalize">{activeSource}</strong></span>
              </>
            )}
          </div>
          <Link href={`/${locale}/community`} className="text-[var(--color-action-blue)] hover:underline font-semibold text-[10px] uppercase tracking-wider">
            {locale === 'vi' ? 'Đặt lại' : 'Reset'}
          </Link>
        </div>
      )}

      {/* Feed List */}
      {data.length > 0 ? (
        <div className="space-y-4">
          {data.map((item) => (
            <div
              key={`${item.type}-${item.id}`}
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] shadow-sm rounded-2xl p-5 hover:border-[var(--color-border-hover)] transition-all animate-fade-in"
            >
              {/* Item Header */}
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)] text-[var(--color-ink-muted-80)] overflow-hidden">
                    {item.authorAvatarUrl ? (
                      <img src={item.authorAvatarUrl} alt={item.authorName} className="w-full h-full object-cover" />
                    ) : (
                      <User size={15} />
                    )}
                  </div>
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-[var(--color-ink)]">
                        {item.type === 'user_review' ? `@${item.authorName}` : item.authorName}
                      </span>
                      {getSourceIcon(item.source)}
                    </div>
                    <span className="text-[10px] text-[var(--color-ink-muted-48)] font-semibold">
                      {timeAgo(item.createdAt)}
                    </span>
                  </div>
                </div>

                {/* Stars (Reviews) or Stats (Social mentions) */}
                <div className="flex items-center gap-2">
                  {item.type === 'user_review' && item.rating && (
                    <div className="flex items-center gap-0.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={12}
                          className={
                            star <= (item.rating || 0)
                              ? 'text-yellow-400 fill-yellow-400'
                              : 'text-[var(--color-border)]'
                          }
                        />
                      ))}
                    </div>
                  )}

                  {item.type === 'social_mention' && (
                    <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-muted-64)] font-medium">
                      {item.score !== undefined && item.score > 0 && (
                        <div className="flex items-center gap-1" title="Score">
                          <Flame className="w-3.5 h-3.5 text-orange-500" />
                          <span>{formatNumber(item.score)}</span>
                        </div>
                      )}
                      {item.commentsCount !== undefined && item.commentsCount > 0 && (
                        <div className="flex items-center gap-1" title="Comments">
                          <MessageCircle className="w-3.5 h-3.5 text-[var(--color-action-blue)]" />
                          <span>{formatNumber(item.commentsCount)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Item Content */}
              <div className="mt-3 text-sm text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap">
                {item.content}
              </div>

              {/* Item Footer - Project & Source Links */}
              <div className="mt-4 flex items-center justify-between border-t border-[var(--color-hairline)] pt-3 text-xs">
                <div className="flex items-center gap-1 text-[var(--color-ink-muted-64)]">
                  <span>{locale === 'vi' ? 'Về dự án:' : 'Project:'}</span>
                  <Link 
                    href={`/${locale}/project/${item.projectSlug}`}
                    className="font-bold text-[var(--color-action-blue)] hover:underline flex items-center gap-0.5"
                  >
                    {item.projectName}
                  </Link>
                </div>

                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[var(--color-action-blue)] hover:underline font-semibold"
                  >
                    <span>{locale === 'vi' ? 'Xem bài gốc' : 'Original Post'}</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-16 bg-[var(--color-bg-secondary)] border border-dashed border-[var(--color-border)] rounded-2xl p-6">
          <MessageSquare className="w-8 h-8 mx-auto text-[var(--color-ink-muted-48)] mb-3" />
          <h3 className="text-sm font-bold text-[var(--color-ink)]">
            {locale === 'vi' ? 'Không tìm thấy hoạt động nào' : 'No activities found'}
          </h3>
          <p className="text-xs text-[var(--color-ink-muted-48)] mt-1">
            {locale === 'vi' ? 'Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm của bạn.' : 'Try changing your filters or search keywords.'}
          </p>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8">
          {/* First Page */}
          <Link
            href={buildUrl({ page: '1' })}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === 1 ? 'pointer-events-none opacity-40' : ''
            }`}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Link>

          {/* Prev Page */}
          <Link
            href={buildUrl({ page: String(currentPage - 1) })}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === 1 ? 'pointer-events-none opacity-40' : ''
            }`}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          {/* Pages */}
          {buildPageNumbers().map((p, idx) => {
            if (p === 'dots') {
              return (
                <span key={`dots-${idx}`} className="px-2 text-xs text-[var(--color-ink-muted-48)]">
                  •••
                </span>
              );
            }

            const isPageActive = currentPage === p;
            return (
              <Link
                key={p}
                href={buildUrl({ page: String(p) })}
                className={`inline-flex items-center justify-center min-w-[34px] h-[34px] rounded-lg text-xs font-semibold border transition-all ${
                  isPageActive
                    ? 'bg-[var(--color-action-blue)] text-white border-[var(--color-action-blue)]'
                    : 'border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)]'
                }`}
              >
                {p}
              </Link>
            );
          })}

          {/* Next Page */}
          <Link
            href={buildUrl({ page: String(currentPage + 1) })}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === totalPages ? 'pointer-events-none opacity-40' : ''
            }`}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>

          {/* Last Page */}
          <Link
            href={buildUrl({ page: String(totalPages) })}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === totalPages ? 'pointer-events-none opacity-40' : ''
            }`}
            title="Last page"
          >
            <ChevronsRight className="w-4 h-4" />
          </Link>
        </div>
      )}
    </div>
  );
}
