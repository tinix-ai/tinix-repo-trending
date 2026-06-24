import React from "react";
import { fetchProjectById, fetchProjectHistory, fetchProjectMentions, fetchSimilarProjects } from "@/app/actions";
import { notFound } from "next/navigation";
import { formatNumber, cleanReadme, timeAgo } from "@/lib/utils";
import { SourceBadge } from "@/components/common/source-badge";
import { ProjectAvatar } from "@/components/common/project-avatar";
import { 
  Star, 
  GitFork, 
  Download, 
  CircleDot, 
  ExternalLink, 
  Clock, 
  Code2, 
  LayoutGrid,
  ArrowLeft,
  Calendar,
  Eye
} from "lucide-react";
import { ViewTracker } from "@/components/project/view-tracker";
import { Link as PageLink } from "@/i18n/routing";
const Anchor = "a";
import { ProjectTabs } from "@/components/project/project-tabs";
import { ProjectHistoryChart } from "@/components/project/history-chart";
import { TopicsList } from "@/components/project/topics-list";
import { SimilarProjects } from "@/components/project/similar-projects";
import { getTranslations } from "next-intl/server";
import type { ProjectMention } from "@/types";

// Metadata generation
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const paramId = resolvedParams.id;
  const uuid = paramId.slice(-36);
  const project = await fetchProjectById(uuid);
  
  if (!project) return { title: "Not Found" };

  return {
    title: `${project.fullName} - Tinix`,
    description: project.description,
  };
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const resolvedParams = await params;
  const { id: paramId, locale } = resolvedParams;
  const uuid = paramId.slice(-36);
  const project = await fetchProjectById(uuid);

  if (!project) {
    notFound();
  }

  let countryName = "";
  if (project.countryCode) {
    try {
      const displayNames = new Intl.DisplayNames([locale], { type: "region" });
      countryName = displayNames.of(project.countryCode.toUpperCase()) || project.countryCode;
    } catch {
      countryName = project.countryCode;
    }
  }

  const t = await getTranslations("ProjectDetail");
  const tNav = await getTranslations("Navigation");
  const historyData = await fetchProjectHistory(project.id, 30);
  const socialMentions = await fetchProjectMentions(project.id);
  const similarProjects = await fetchSimilarProjects(project.id, 3);
  const isGithub = project.source === "github";
  const isHuggingFace = project.source === "huggingface";
  const cleanedReadme = cleanReadme(project.readme);

  // Sắp xếp bài thảo luận theo thời gian mới nhất (giảm dần)
  const sortedMentions = [...socialMentions].sort(
    (a, b) => new Date(b.mentionedAt).getTime() - new Date(a.mentionedAt).getTime()
  );

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": project.name,
    "displayName": project.fullName,
    "description": project.description || "",
    "applicationCategory": project.categories?.[0] || "DeveloperApplication",
    "operatingSystem": "Cross-platform",
    "codeRepository": project.sourceUrl,
    "author": {
      "@type": "Organization",
      "name": project.ownerName,
      "image": project.ownerAvatarUrl || undefined,
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "USD"
    },
    ...(project.stars > 0 ? {
      "aggregateRating": {
        "@type": "AggregateRating",
        "ratingValue": "4.8",
        "ratingCount": project.stars,
        "bestRating": "5",
        "worstRating": "1"
      }
    } : {})
  };

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      <ViewTracker projectId={project.id} />
      {/* JSON-LD Structured Data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* Hero Section */}
      <section className="apple-tile-light w-full py-8 lg:py-12 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="flex flex-col gap-6">
            
            {/* Breadcrumb */}
            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-divider-soft)] pb-4 mb-2">
              <PageLink 
                href="/" 
                className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 hover:bg-[var(--color-canvas)] transition-all duration-200"
              >
                <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
                {t("backBtn")}
              </PageLink>
              
              <div className="h-4 w-px bg-[var(--color-border)] mx-1 hidden sm:block" />
              
              <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-48)]">
                <PageLink href="/" className="hover:text-[var(--color-ink)] transition-colors">
                  {tNav("trending")}
                </PageLink>
                <span className="text-[var(--color-border)] select-none">/</span>
                {project.categories && project.categories.length > 0 && (
                  <>
                    <PageLink 
                      href={`/?category=${project.categories[0].toLowerCase().replace(/\s+/g, "-")}`}
                      className="hover:text-[var(--color-ink)] transition-colors truncate max-w-[120px]"
                    >
                      {project.categories[0]}
                    </PageLink>
                    <span className="text-[var(--color-border)] select-none">/</span>
                  </>
                )}
                <span className="text-[var(--color-ink-muted-80)] truncate max-w-[180px]">
                  {project.name}
                </span>
              </nav>
            </div>

            {/* Source Badges */}
            <div className="flex items-center gap-3">
              <SourceBadge source={project.source} projectType={project.projectType} />
              {project.primaryLanguage && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-80)] bg-[var(--color-bg-secondary)] px-2.5 py-1 rounded-md border border-[var(--color-border)]">
                  <Code2 className="h-3.5 w-3.5" />
                  {project.primaryLanguage}
                </span>
              )}
              {project.countryCode && (
                <span className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-80)] bg-[var(--color-bg-secondary)] px-2.5 py-1 rounded-md border border-[var(--color-border)]" title={project.location || undefined}>
                  <img
                    src={`https://flagcdn.com/w20/${project.countryCode.toLowerCase()}.png`}
                    alt={project.countryCode}
                    className="w-4.5 h-3.5 object-cover rounded-sm shadow-sm border border-[var(--color-border)] select-none shrink-0"
                  />
                  {countryName}
                </span>
              )}
            </div>

            {/* Title & Avatar */}
            <div className="flex items-center gap-4 flex-wrap">
              <ProjectAvatar 
                src={project.ownerAvatarUrl} 
                name={project.ownerName} 
                size={40} 
              />
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-ink)] break-all whitespace-normal">
                {project.fullName}
              </h1>
            </div>

            {/* Description */}
            <p className="text-apple-body text-[var(--color-ink-muted-80)] max-w-3xl leading-relaxed">
              {project.description || "No description provided for this repository."}
            </p>

            {/* Stats Bar */}
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3 py-3 border-y border-[var(--color-divider-soft)] mt-2">
              {isGithub && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-[var(--color-warning)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.stars)}</span>
                    <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("stars")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <GitFork className="h-4 w-4 text-[var(--color-ink-muted-80)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.forks)}</span>
                    <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("forks")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <CircleDot className="h-4 w-4 text-[var(--color-positive)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.openIssues)}</span>
                    <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("issues")}</span>
                  </div>
                </>
              )}

              {isHuggingFace && (
                <>
                  <div className="flex items-center gap-1.5">
                    <Star className="h-4 w-4 text-[var(--color-warning)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.stars)}</span>
                    <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("likes")}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Download className="h-4 w-4 text-[var(--color-info)]" />
                    <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.downloads)}</span>
                    <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("downloads")}</span>
                  </div>
                </>
              )}
              {project.views !== undefined && (
                <div className="flex items-center gap-1.5" title={`${formatNumber(project.views)} views`}>
                  <Eye className="h-4 w-4 text-[var(--color-ink-muted-80)]" />
                  <span className="text-sm font-semibold text-[var(--color-ink)] tabular-nums">{formatNumber(project.views)}</span>
                  <span className="text-xs text-[var(--color-ink-muted-80)] uppercase tracking-wider font-medium">{t("views")}</span>
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <Anchor 
                href={project.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="apple-btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
              >
                {t("visitRepo")} <ExternalLink className="h-3.5 w-3.5" />
              </Anchor>
              {project.homepageUrl && (
                <Anchor 
                  href={project.homepageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="apple-btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 bg-[var(--color-canvas)]"
                >
                  {t("homepage")} <ExternalLink className="h-3.5 w-3.5" />
                </Anchor>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="apple-tile-parchment w-full py-16 min-h-[50vh]">
        <div className="page-container max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          
          {/* Left Column: Chart & README */}
          <div className="min-w-0 space-y-8">
            
            {/* Tabs Component (README & Social Mentions) */}
            <ProjectTabs 
              cleanedReadme={cleanedReadme} 
              socialMentions={sortedMentions} 
              sourceUrl={project.sourceUrl || undefined} 
              source={project.source} 
            />
          </div>

          {/* Right Column: Sidebar */}
          <aside className="space-y-6">
            
            {/* Historical Chart Widget */}
            <div className="apple-utility-card hover-spring p-5 overflow-hidden">
              <h3 className="text-apple-body-strong mb-4 text-[var(--color-ink)] flex items-center gap-2 text-sm">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs">📈</span>
                {t("growthHistory")}
              </h3>
              <div className="h-[200px]">
                <ProjectHistoryChart data={historyData} source={project.source} />
              </div>
            </div>

            {/* Social Discussions & Mentions Widget */}
            <div className="apple-utility-card hover-spring p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2 text-sm text-[var(--color-ink)]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs">💬</span>
                {t("socialDiscussions")}
              </h3>
              
              {sortedMentions && sortedMentions.length > 0 ? (
                <div className="space-y-4 divide-y divide-[var(--color-divider-soft)]">
                  {sortedMentions.slice(0, 5).map((mention: ProjectMention, idx: number) => (
                    <div key={mention.id} className={`flex flex-col gap-1.5 ${idx > 0 ? 'pt-4' : ''}`}>
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-[var(--color-ink)]">
                          {mention.source === 'reddit' ? 'Reddit' : mention.source === 'x' ? 'X (Twitter)' : 'Hacker News'}
                        </span>
                        <span className="text-[var(--color-ink-muted-48)] uppercase tracking-wider font-semibold">
                          {timeAgo(mention.mentionedAt)}
                        </span>
                      </div>
                      <p className="text-xs text-[var(--color-ink-muted-80)] leading-relaxed break-words line-clamp-3">
                        {mention.content}
                      </p>
                      <div className="flex items-center justify-between text-[11px] font-semibold text-[var(--color-ink-muted-80)] mt-0.5">
                        <span>@{mention.author.split('/').pop()}</span>
                        <Anchor 
                          href={mention.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline font-semibold"
                        >
                          {t("visitRepo")} <ExternalLink className="h-3.5 w-3.5" />
                        </Anchor>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-6">
                  <p className="text-xs text-[var(--color-ink-muted-80)] font-semibold mb-1">{t("noSocialMentions")}</p>
                  <p className="text-[11px] text-[var(--color-ink-muted-48)] leading-normal">{t("noSocialMentionsDesc")}</p>
                </div>
              )}
            </div>

            {/* AI Summary Widget */}
            {project.aiSummary && (
              <div className="apple-utility-card hover-spring p-6 bg-[var(--color-canvas)] border border-[var(--color-action-blue)]/20">
                <h3 className="text-apple-body-strong mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-action-blue)] text-white">✨</span>
                  {t("aiSummary")}
                </h3>
                <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed">
                  {project.aiSummary}
                </p>
              </div>
            )}

            {/* Categories & Topics */}
            {(project.categories?.length > 0 || project.topics?.length > 0) && (
              <div className="apple-utility-card hover-spring p-6">
                <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                  {t("classification")}
                </h3>
                {project.categories?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">{t("categories")}</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(project.categories)).map((cat: string) => (
                        <PageLink 
                          key={cat} 
                          href={`/?category=${cat.toLowerCase().replace(/\s+/g, "-")}`}
                          className="inline-flex items-center rounded-md bg-[var(--color-bg-secondary)] hover:bg-[var(--color-divider-soft)] px-2.5 py-1 text-xs font-semibold text-[var(--color-ink)] border border-[var(--color-border)] hover:border-[var(--color-action-blue)]/30 hover:text-[var(--color-action-blue)] transition-all duration-200 cursor-pointer"
                        >
                          {cat}
                        </PageLink>
                      ))}
                    </div>
                  </div>
                )}

                {project.topics?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">{t("topics")}</div>
                    <TopicsList 
                      topics={project.topics}
                      showMoreLabel={t("showMore")}
                      showLessLabel={t("showLess")}
                    />
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="apple-utility-card hover-spring p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                {t("timeline")}
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-ink-muted-80)]">{t("created")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.sourceCreatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-ink-muted-80)]">{t("lastUpdated")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.updatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-[var(--color-divider-soft)] pt-3">
                  <span className="text-[var(--color-ink-muted-80)]">{t("lastCrawled")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.lastCrawledAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Meta Info */}
            <div className="apple-utility-card hover-spring p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                {t("metaInfo")}
              </h3>
              <ul className="space-y-4 text-sm">
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("createdOn")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.sourceCreatedAt ? new Date(project.sourceCreatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }) : 'Unknown'}
                  </span>
                </li>
                {project.countryCode && (
                  <li className="flex flex-col gap-1">
                    <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("origin")}</span>
                    <div className="flex items-center gap-1.5 font-medium text-[var(--color-ink)]">
                      <img
                        src={`https://flagcdn.com/w20/${project.countryCode.toLowerCase()}.png`}
                        alt={project.countryCode}
                        className="w-5 h-3.5 object-cover rounded-sm shadow-sm border border-[var(--color-border)] select-none shrink-0"
                      />
                      <span>{countryName}</span>
                      {project.location && (
                        <span className="text-xs text-[var(--color-ink-muted-80)] font-normal">({project.location})</span>
                      )}
                    </div>
                  </li>
                )}
                {project.license && (
                  <li className="flex flex-col gap-1">
                    <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("license")}</span>
                    <span className="text-[var(--color-ink)] font-medium">{project.license}</span>
                  </li>
                )}
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("lastCrawled")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.lastCrawledAt ? new Date(project.lastCrawledAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Ho_Chi_Minh' }) : 'Recently'}
                  </span>
                </li>
              </ul>
            </div>

          </aside>
          </div>
          <SimilarProjects projects={similarProjects} />
        </div>
      </section>
    </div>
  );
}
