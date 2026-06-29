import React from 'react';
import { getTranslations } from 'next-intl/server';
import { fetchCategoryProjectsForForum } from '@/app/actions';
import { Link } from '@/i18n/routing';
import { ProjectAvatar } from '@/components/common/project-avatar';
import { SourceBadge } from '@/components/common/source-badge';
import { formatNumber } from '@/lib/utils';
import { 
  ArrowLeft, 
  MessageCircle, 
  ChevronLeft, 
  ChevronRight, 
  ChevronsLeft, 
  ChevronsRight,
  ArrowUpRight,
  Star,
  GitFork,
  Heart,
  Download
} from 'lucide-react';

interface CategoryPageProps {
  params: Promise<{ slug: string; locale: string }>;
  searchParams: Promise<{ page?: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug, locale } = await params;
  return {
    title: `${slug.toUpperCase()} Threads | TiniX Community`,
    description: `Browse all project discussion threads in the ${slug} category.`,
  };
}

export default async function CategoryPage({ params, searchParams }: CategoryPageProps) {
  const { slug, locale } = await params;
  const sp = await searchParams;
  const currentPage = Math.max(1, parseInt(sp.page || '1', 10));

  const tNav = await getTranslations({ locale, namespace: 'Navigation' });

  // Fetch category projects
  const { data: threads, total, totalPages, categoryName } = await fetchCategoryProjectsForForum(slug, {
    page: currentPage,
    perPage: 25
  });

  const getSourceBadge = (source: string) => {
    switch (source) {
      case 'user':
        return <span className="text-[9px] bg-blue-500/10 text-blue-600 px-1.5 py-0.5 rounded font-bold uppercase">Member</span>;
      case 'reddit':
        return <span className="text-[9px] bg-orange-500/10 text-orange-600 px-1.5 py-0.5 rounded font-bold uppercase">Reddit</span>;
      case 'x':
        return <span className="text-[9px] bg-[var(--color-ink)]/5 text-[var(--color-ink)] px-1.5 py-0.5 rounded font-bold uppercase">X</span>;
      case 'hacker_news':
        return <span className="text-[9px] bg-amber-500/10 text-amber-600 px-1.5 py-0.5 rounded font-bold uppercase">HN</span>;
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
    if (diffMin < 60) return locale === 'vi' ? `${diffMin}m` : `${diffMin}m ago`;
    if (diffHr < 24) return locale === 'vi' ? `${diffHr}h` : `${diffHr}h ago`;
    return d.toLocaleDateString(locale === 'vi' ? 'vi-VN' : 'en-US', { month: 'short', day: 'numeric' });
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

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 mb-6">
        <Link 
          href="/community" 
          className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 hover:bg-[var(--color-canvas)] transition-all"
        >
          <ArrowLeft className="w-3.5 h-3.5 transition-transform group-hover:-translate-x-0.5" />
          {tNav("community")}
        </Link>
      </div>

      {/* Header */}
      <section className="apple-tile-light w-full py-10 mb-8 border-b border-[var(--color-divider-soft)] rounded-3xl mx-auto overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-action-blue)]/5 to-transparent"></div>
        <div className="flex flex-col items-start max-w-4xl gap-3 px-6 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-action-blue)]/30 bg-[var(--color-action-blue)]/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-action-blue)] uppercase shadow-sm">
              <MessageCircle className="w-3.5 h-3.5" />
              {locale === 'vi' ? 'Danh mục' : 'Category'}
            </div>
          </div>
          
          <h1 className="text-apple-hero text-[var(--color-ink)] mb-1">
            {categoryName}
          </h1>

          <p className="text-apple-lead text-[var(--color-ink-muted-80)]">
            {total} {locale === 'vi' ? 'Chủ đề thảo luận' : 'Discussion threads'}
          </p>
        </div>
      </section>

      {/* Threads Table Box */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl overflow-hidden shadow-sm">
        {threads.length > 0 ? (
          <div className="divide-y divide-[var(--color-divider-soft)]">
            {threads.map((thread) => (
              <div 
                key={thread.id} 
                className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--color-canvas)]/20 transition-colors"
              >
                {/* Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="mt-1">
                    <ProjectAvatar 
                      src={thread.ownerAvatarUrl || undefined} 
                      name={thread.fullName} 
                      size={40} 
                      className="transition-transform duration-300 shrink-0" 
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1 min-w-0 w-full">
                      <Link
                        href={`/project/${thread.slug.replace(/\//g, '-')}-${thread.id}?tab=community`}
                        className="group/link inline-flex items-center gap-1.5 min-w-0 max-w-full"
                      >
                        <h3 className="text-[16px] font-semibold text-[var(--color-text-primary)] group-hover/link:text-[var(--color-accent)] transition-colors truncate">
                          {thread.fullName}
                        </h3>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 group-hover/link:opacity-100 transition-all group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 shrink-0" />
                      </Link>
                      <SourceBadge source={thread.source as any} projectType={thread.projectType as any} iconOnly />
                      
                      {/* Project Metrics badge row */}
                      <div className="flex items-center gap-2 shrink-0 ml-2">
                        {thread.source === "github" ? (
                          <>
                            <span className="metric-badge">
                              <Star className="text-[var(--color-warning)]" />
                              <span className="text-[var(--color-text-primary)] font-medium">
                                {formatNumber(thread.stars)}
                              </span>
                            </span>
                            <span className="metric-badge">
                              <GitFork />
                              {formatNumber(thread.forks)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="metric-badge">
                              <Heart className="text-rose-500 fill-rose-500 w-3.5 h-3.5" />
                              <span className="text-[var(--color-text-primary)] font-medium">
                                {formatNumber(thread.likes)}
                              </span>
                            </span>
                            <span className="metric-badge">
                              <Download className="text-[var(--color-info)] shrink-0 w-3.5 h-3.5" />
                              <span className="text-[var(--color-text-primary)] font-medium">
                                {formatNumber(thread.downloads)}
                              </span>
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    
                    <p className="text-xs text-[var(--color-text-secondary)] line-clamp-2 mt-1 leading-relaxed break-words">
                      {thread.description}
                    </p>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center gap-6 sm:text-right shrink-0 md:pl-4">
                  <div className="flex flex-col sm:items-end">
                    <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1">
                      <MessageCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                      {thread.totalActivity}
                    </span>
                    <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">
                      {locale === 'vi' ? 'Thảo luận' : 'posts'}
                    </span>
                  </div>

                  {/* Last Activity */}
                  {thread.lastActivity ? (
                    <div className="flex flex-col sm:items-end text-left sm:text-right text-[11px] max-w-[120px] min-w-[100px]">
                      <div className="flex items-center gap-1 sm:justify-end text-[var(--color-text-primary)] font-semibold truncate w-full">
                        {getSourceBadge(thread.lastActivity.type)}
                        <span className="truncate">@{thread.lastActivity.author}</span>
                      </div>
                      <span className="text-[10px] text-[var(--color-text-muted)] font-medium">
                        {timeAgo(thread.lastActivity.time)}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-[var(--color-text-muted)] font-medium min-w-[100px] sm:text-right">
                      {locale === 'vi' ? 'Chưa có hoạt động' : 'No activity'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-16 text-center text-sm text-[var(--color-ink-muted-48)] font-medium">
            {locale === 'vi' ? 'Chưa có chủ đề thảo luận nào' : 'No discussions yet'}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 mt-8">
          <Link
            href={`/community/category/${slug}?page=1`}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === 1 ? 'pointer-events-none opacity-40' : ''
            }`}
            title="First page"
          >
            <ChevronsLeft className="w-4 h-4" />
          </Link>
          <Link
            href={`/community/category/${slug}?page=${currentPage - 1}`}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === 1 ? 'pointer-events-none opacity-40' : ''
            }`}
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          {buildPageNumbers().map((p, idx) => {
            if (p === 'dots') {
              return (
                <span key={`dots-${idx}`} className="px-2 text-xs text-[var(--color-ink-muted-48)]">
                  •••
                </span>
              );
            }
            return (
              <Link
                key={p}
                href={`/community/category/${slug}?page=${p}`}
                className={`inline-flex items-center justify-center min-w-[34px] h-[34px] rounded-lg text-xs font-semibold border transition-all ${
                  currentPage === p
                    ? 'bg-[var(--color-action-blue)] text-white border-[var(--color-action-blue)]'
                    : 'border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)]'
                }`}
              >
                {p}
              </Link>
            );
          })}

          <Link
            href={`/community/category/${slug}?page=${currentPage + 1}`}
            className={`p-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-canvas)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors ${
              currentPage === totalPages ? 'pointer-events-none opacity-40' : ''
            }`}
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
          <Link
            href={`/community/category/${slug}?page=${totalPages}`}
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
