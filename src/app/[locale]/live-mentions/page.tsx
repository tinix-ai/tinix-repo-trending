import React from 'react';
import { fetchRecentSocialMentions } from '@/app/actions';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/routing';
import { timeAgo, formatNumber } from '@/lib/utils';
import { 
  ArrowLeft, 
  ExternalLink, 
  MessageSquare,
  MessageCircle,
  TrendingUp,
  User
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
  searchParams: Promise<{ source?: string }>;
}

export default async function LiveMentionsPage({ params, searchParams }: PageProps) {
  const resolvedParams = await params;
  const { locale } = resolvedParams;
  const resolvedSearchParams = await searchParams;
  const activeSource = resolvedSearchParams.source || 'all';

  const t = await getTranslations({ locale, namespace: 'SocialListening' });
  const tNav = await getTranslations({ locale, namespace: 'Navigation' });

  // Fetch recent mentions (max 50 to display in feed)
  const allMentions = await fetchRecentSocialMentions(50);
  
  // Filter on server side
  const filteredMentions = activeSource === 'all' 
    ? allMentions 
    : allMentions.filter(m => m.source === activeSource);

  // Social Source icons/tags helpers
  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'reddit':
        return <span className="text-orange-500 font-bold text-xs uppercase bg-orange-500/10 border border-orange-500/20 px-2 py-0.5 rounded-full">Reddit</span>;
      case 'x':
        return <span className="text-[var(--color-ink)] font-bold text-xs bg-[var(--color-ink)]/5 border border-[var(--color-ink)]/10 px-2 py-0.5 rounded-full">X (Twitter)</span>;
      case 'hacker_news':
        return <span className="text-amber-600 font-bold text-xs uppercase bg-amber-600/10 border border-amber-600/20 px-2 py-0.5 rounded-full">Hacker News</span>;
      default:
        return null;
    }
  };

  const sourceOptions = [
    { key: 'all', label: t('allSources') },
    { key: 'reddit', label: t('redditSource') },
    { key: 'x', label: t('xSource') },
    { key: 'hacker_news', label: t('hnSource') }
  ];

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      {/* Hero Header */}
      <section className="apple-tile-light w-full py-8 lg:py-12 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="flex flex-col gap-6">
            
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider-soft)] pb-4 mb-2">
              <Link 
                href="/" 
                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 hover:bg-[var(--color-canvas)] transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                {tNav("trending")}
              </Link>
              
              <div className="h-4 w-px bg-[var(--color-border)] mx-1" />
              
              <nav className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-48)]">
                <span className="text-[var(--color-ink-muted-80)]">
                  {t('header')}
                </span>
              </nav>
            </div>

            {/* Title with live telemetry indicator */}
            <div className="flex flex-wrap items-center gap-4">
              <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-ink)] flex items-center gap-3">
                {t('header')}
                
                {/* Pulse telemetry animation */}
                <span className="relative flex h-3 w-3 select-none">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
              </h1>
            </div>

            <p className="text-apple-body text-[var(--color-ink-muted-80)] max-w-3xl leading-relaxed">
              {t('subtitle')}
            </p>
          </div>
        </div>
      </section>

      {/* Social Mentions Feed */}
      <section className="apple-tile-parchment w-full py-12 min-h-[60vh]">
        <div className="page-container max-w-5xl">
          
          {/* Source filters */}
          <div className="flex flex-wrap items-center gap-2 border-b border-[var(--color-divider-soft)] pb-4 mb-8">
            {sourceOptions.map(opt => {
              const isActive = activeSource === opt.key;
              const href = opt.key === 'all' ? '/live-mentions' : `/live-mentions?source=${opt.key}`;
              return (
                <Link
                  key={opt.key}
                  href={href}
                  className={`inline-flex h-8 items-center rounded-full px-4 text-xs font-semibold uppercase tracking-wider transition-all duration-200 ${
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

          {/* Feed list */}
          {filteredMentions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredMentions.map((mention) => {
                const projectDetailUrl = `/project/${mention.projectSlug.replace(/\//g, '-')}-${mention.projectId}`;
                return (
                  <div 
                    key={mention.id}
                    className="apple-utility-card hover-spring p-6 flex flex-col justify-between"
                  >
                    {/* Header: Project name & Source */}
                    <div className="flex items-start justify-between gap-4 mb-4">
                      <div className="flex flex-col gap-1 min-w-0">
                        <Link 
                          href={projectDetailUrl}
                          className="font-bold text-sm text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate block"
                        >
                          {mention.projectFullName}
                        </Link>
                        <div className="flex items-center gap-2">
                          <SourceBadge source={mention.projectSource} size="sm" />
                          <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider font-semibold">
                            {timeAgo(mention.mentionedAt)}
                          </span>
                        </div>
                      </div>
                      {getSourceIcon(mention.source)}
                    </div>

                    {/* Content text */}
                    <div className="flex-1 mb-6">
                      <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed whitespace-pre-wrap line-clamp-4 break-words">
                        {mention.content}
                      </p>
                    </div>

                    {/* Footer: User, Metrics & Links */}
                    <div className="flex items-center justify-between border-t border-[var(--color-divider-soft)] pt-4 mt-auto">
                      <div className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted-80)]">
                        <User className="h-3.5 w-3.5 text-[var(--color-ink-muted-48)]" />
                        <span className="font-semibold truncate max-w-[120px]">
                          {mention.author.split('/').pop()}
                        </span>
                      </div>

                      <div className="flex items-center gap-4 text-xs font-semibold tabular-nums text-[var(--color-ink-muted-80)]">
                        <span className="flex items-center gap-1">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                          {formatNumber(mention.score)}
                        </span>
                        <span className="flex items-center gap-1">
                          <MessageCircle className="h-3.5 w-3.5 text-zinc-500" />
                          {formatNumber(mention.commentsCount)}
                        </span>
                        <a 
                          href={mention.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="apple-utility-card p-12 text-center flex flex-col items-center justify-center border-dashed">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-[var(--color-ink-muted-48)]" />
              </div>
              <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">{t("noMentions")}</h3>
              <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                {t("noMentionsDesc")}
              </p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
