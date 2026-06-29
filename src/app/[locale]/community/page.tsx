import React from 'react';
import { getTranslations } from 'next-intl/server';
import { fetchForumCategoriesWithThreads, fetchUnifiedCommunityFeed } from '@/app/actions';
import { Link } from '@/i18n/routing';
import { CategoryIcon } from '@/components/common/category-icon';
import { ProjectAvatar } from '@/components/common/project-avatar';
import { SourceBadge } from '@/components/common/source-badge';
import { formatNumber } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  Clock, 
  MessageCircle, 
  TrendingUp, 
  BookOpen, 
  Flame,
  ArrowRight,
  User,
  Star,
  GitFork,
  Heart,
  Download,
  ArrowUpRight
} from 'lucide-react';

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Navigation' });
  return {
    title: `${t('community')} | TiniX Repo Trending`,
    description: "Discuss, rate, and review trending open-source AI/ML projects.",
  };
}

export default async function CommunityPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'Navigation' });

  // 1. Fetch categories with threads
  const categories = await fetchForumCategoriesWithThreads();

  // 2. Fetch latest global community posts for sidebar
  const { data: latestFeed } = await fetchUnifiedCommunityFeed({
    page: 1,
    perPage: 5,
    source: 'all',
    sort: 'newest'
  });

  // Calculate statistics
  let totalThreads = 0;
  let totalPosts = 0;
  categories.forEach(cat => {
    totalThreads += cat.threads.length;
    cat.threads.forEach(t => {
      totalPosts += t.totalActivity;
    });
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

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      {/* Header section */}
      <section className="apple-tile-light w-full py-10 mb-8 border-b border-[var(--color-divider-soft)] rounded-3xl mx-auto overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-action-blue)]/5 to-transparent"></div>
        <div className="flex flex-col items-start md:items-center md:text-center max-w-4xl mx-auto gap-4 px-6 relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <div className="flex items-center gap-1.5 rounded-full border border-[var(--color-action-blue)]/30 bg-[var(--color-action-blue)]/10 px-3 py-1 text-[11px] font-semibold tracking-wider text-[var(--color-action-blue)] uppercase shadow-sm">
              <Users className="w-3.5 h-3.5" />
              {t('community')}
            </div>
          </div>
          
          <h1 className="text-apple-hero text-[var(--color-ink)] mb-1">
            {locale === 'vi' ? 'Khám phá ' : 'Discover '}
            <span className="text-[var(--color-action-blue)] block sm:inline">
              {locale === 'vi' ? 'Cộng đồng' : 'Community'}
            </span>
          </h1>

          <p className="text-apple-lead text-[var(--color-ink-muted-80)] max-w-2xl">
            {locale === 'vi' 
              ? 'Diễn đàn thảo luận công nghệ, nơi đánh giá dự án từ cộng đồng và cập nhật tin tức mạng xã hội.' 
              : 'Tech discussion forum, where the community rates projects and discusses social media updates.'}
          </p>
        </div>
      </section>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8">
        
        {/* Left Column: Category Board */}
        <div className="space-y-8">
          {categories.map((cat) => (
            <div 
              key={cat.id} 
              className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl overflow-hidden shadow-sm"
            >
              {/* Category Header */}
              <div 
                className="px-6 py-4 flex items-center justify-between border-b border-[var(--color-divider-soft)]"
                style={{ borderTop: `4px solid ${cat.color || 'var(--color-action-blue)'}` }}
              >
                <div className="flex items-center gap-3">
                  <div 
                    className="p-2 rounded-lg text-white" 
                    style={{ backgroundColor: cat.color || 'var(--color-action-blue)' }}
                  >
                    <CategoryIcon name={cat.id} className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-md font-bold text-[var(--color-ink)] tracking-tight">
                      {cat.id}
                    </h2>
                    <span className="text-[10px] text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
                      {cat.threads.length} {locale === 'vi' ? 'chủ đề' : 'threads'}
                    </span>
                  </div>
                </div>
                <Link 
                  href={`/community/category/${cat.id.toLowerCase().replace(/\s+/g, '-')}`}
                  className="text-xs font-semibold text-[var(--color-action-blue)] hover:underline flex items-center gap-1"
                >
                  {locale === 'vi' ? 'Xem tất cả' : 'View all'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {/* Thread List */}
              {cat.threads.length > 0 ? (
                <div className="divide-y divide-[var(--color-divider-soft)]">
                  {cat.threads.map((thread) => (
                    <div 
                      key={thread.id} 
                      className="px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-[var(--color-canvas)]/20 transition-colors"
                    >
                      {/* Thread Title & Info */}
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

                      {/* Thread Activity Stats */}
                      <div className="flex items-center gap-6 sm:text-right shrink-0 md:pl-4">
                        <div className="flex flex-col sm:items-end">
                          <span className="text-xs font-bold text-[var(--color-text-primary)] flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5 text-[var(--color-text-muted)]" />
                            {thread.totalActivity}
                          </span>
                          <span className="text-[10px] text-[var(--color-text-muted)] font-medium uppercase tracking-wide">
                            {locale === 'vi' ? 'thảo luận' : 'posts'}
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
                <div className="p-8 text-center text-xs text-[var(--color-ink-muted-48)] font-medium">
                  {locale === 'vi' ? 'Chưa có chủ đề nào trong danh mục này' : 'No threads in this category yet'}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">
          {/* General Stats */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider border-b border-[var(--color-divider-soft)] pb-3 mb-4">
              {locale === 'vi' ? 'Thống kê diễn đàn' : 'Forum Statistics'}
            </h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-ink-muted-80)] font-medium">{locale === 'vi' ? 'Tổng số chủ đề' : 'Total Threads'}</span>
                <span className="text-xs font-bold text-[var(--color-ink)] tabular-nums">{totalThreads}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[var(--color-ink-muted-80)] font-medium">{locale === 'vi' ? 'Tổng số bài viết' : 'Total Posts'}</span>
                <span className="text-xs font-bold text-[var(--color-ink)] tabular-nums">{totalPosts}</span>
              </div>
            </div>
          </div>

          {/* Latest Posts */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-5 shadow-sm">
            <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider border-b border-[var(--color-divider-soft)] pb-3 mb-4">
              {locale === 'vi' ? 'Hoạt động mới nhất' : 'Latest Activities'}
            </h3>
            {latestFeed.length > 0 ? (
              <div className="space-y-4">
                {latestFeed.map((item) => (
                  <div key={`${item.type}-${item.id}`} className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-[var(--color-ink)]">
                        @{item.authorName}
                      </span>
                      {getSourceBadge(item.source)}
                    </div>
                    <p className="text-[11px] text-[var(--color-ink-muted-64)] line-clamp-2 leading-relaxed">
                      {item.content}
                    </p>
                    <div className="flex items-center justify-between text-[10px] text-[var(--color-ink-muted-48)] font-semibold mt-1">
                      <Link href={`/project/${item.projectSlug.replace(/\//g, '-')}-${item.projectId}?tab=community`} className="text-[var(--color-action-blue)] hover:underline truncate max-w-[150px]">
                        #{item.projectName}
                      </Link>
                      <span>{timeAgo(item.createdAt)}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[var(--color-ink-muted-48)] text-center py-4 font-medium">
                {locale === 'vi' ? 'Chưa có hoạt động nào' : 'No activities yet'}
              </p>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
