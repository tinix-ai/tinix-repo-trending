import React from 'react';
import { getTranslations } from 'next-intl/server';
import { 
  fetchProjectThreadDetails, 
  fetchProjectMentions, 
  fetchProjectReviews 
} from '@/app/actions';
import { notFound } from 'next/navigation';
import { Link } from '@/i18n/routing';
import { ProjectAvatar } from '@/components/common/project-avatar';
import { ThreadReplies } from '@/components/community/thread-replies';
import { 
  ArrowLeft, 
  ExternalLink, 
  Github, 
  Star, 
  Heart, 
  Eye, 
  Globe 
} from 'lucide-react';
import { SourceBadge } from '@/components/common/source-badge';

interface ThreadPageProps {
  params: Promise<{ slug: string; locale: string }>;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string; locale: string }> }) {
  const { slug } = await params;
  const project = await fetchProjectThreadDetails(slug);
  if (!project) return { title: "Thread Not Found" };
  return {
    title: `${project.name} Discussion | TiniX Community`,
    description: project.description || `Join discussions on ${project.fullName} on TiniX.`,
  };
}

export default async function ThreadPage({ params }: ThreadPageProps) {
  const { slug, locale } = await params;
  
  // Fetch project details
  const project = await fetchProjectThreadDetails(slug);
  if (!project) {
    notFound();
  }

  const tNav = await getTranslations({ locale, namespace: 'Navigation' });

  // Fetch initial social mentions and reviews
  const socialMentions = await fetchProjectMentions(project.id);
  const reviews = await fetchProjectReviews(project.id);

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

      {/* Main Grid: Thread Topic + Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-8 items-start">
        
        {/* Left Column: Topic Post + Replies */}
        <div className="space-y-8">
          
          {/* Thread Header (OP) */}
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div className="flex items-center gap-3">
                <ProjectAvatar 
                  name={project.name} 
                  src={project.ownerAvatarUrl || undefined} 
                  size={48} 
                />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-xl md:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
                      {project.name}
                    </h1>
                    <SourceBadge source={project.source} />
                  </div>
                  <span className="text-xs text-[var(--color-ink-muted-48)] font-semibold uppercase tracking-wider">
                    {project.fullName}
                  </span>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 text-xs font-semibold tabular-nums text-[var(--color-ink-muted-80)] bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-xl px-3 py-1.5">
                {project.source === 'github' ? (
                  <span className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    {project.stars?.toLocaleString() || 0}
                  </span>
                ) : (
                  <span className="flex items-center gap-1">
                    <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" />
                    {project.likes?.toLocaleString() || 0}
                  </span>
                )}
                <span className="flex items-center gap-1">
                  <Eye className="w-3.5 h-3.5 text-blue-500" />
                  {project.views?.toLocaleString() || 0}
                </span>
              </div>
            </div>

            {/* Description */}
            <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed">
              {project.description}
            </p>

            {/* AI Summary */}
            {project.aiSummary && (
              <div className="bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] p-4 rounded-xl space-y-2">
                <h4 className="text-xs font-bold text-[var(--color-action-blue)] uppercase tracking-wider">
                  AI Summary
                </h4>
                <p className="text-xs text-[var(--color-ink-muted-80)] leading-relaxed">
                  {project.aiSummary}
                </p>
              </div>
            )}

            {/* External Links */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href={project.sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer"
              >
                {project.source === 'github' ? <Github className="w-4 h-4" /> : <Globe className="w-4 h-4" />}
                <span>Repository</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {project.homepageUrl && (
                <a
                  href={project.homepageUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 border border-[var(--color-border)] rounded-xl text-xs font-semibold text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all cursor-pointer"
                >
                  <Globe className="w-4 h-4" />
                  <span>Homepage</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>

          {/* Interactive Thread Replies (unified social mentions + user comments) */}
          <ThreadReplies 
            projectId={project.id}
            initialSocialMentions={socialMentions}
            initialReviews={reviews}
            locale={locale}
          />

        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-6">
          <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-5 shadow-sm space-y-4">
            <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider border-b border-[var(--color-divider-soft)] pb-3 mb-2">
              {locale === 'vi' ? 'Thông tin chủ đề' : 'Thread Info'}
            </h3>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-muted-64)]">{locale === 'vi' ? 'Tổng thảo luận' : 'Total Activity'}</span>
                <span className="font-bold text-[var(--color-ink)]">{socialMentions.length + reviews.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-muted-64)]">{locale === 'vi' ? 'Bình luận thành viên' : 'Member Comments'}</span>
                <span className="font-bold text-[var(--color-ink)]">{reviews.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[var(--color-ink-muted-64)]">{locale === 'vi' ? 'Trích dẫn MXH' : 'Social Mentions'}</span>
                <span className="font-bold text-[var(--color-ink)]">{socialMentions.length}</span>
              </div>
            </div>
            <div className="border-t border-[var(--color-divider-soft)] pt-3 text-center">
              <Link 
                href={`/project/${project.slug}-${project.id}`}
                className="inline-flex h-9 items-center justify-center rounded-xl border border-[var(--color-border)] px-4 text-xs font-bold text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-canvas)] transition-all w-full"
              >
                {locale === 'vi' ? 'Xem đầy đủ dự án' : 'View Full Project Profile'}
              </Link>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
