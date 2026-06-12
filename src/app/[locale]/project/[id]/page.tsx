import { fetchProjectById, fetchProjectHistory } from "@/app/actions";
import { notFound } from "next/navigation";
import { formatNumber, cleanReadme } from "@/lib/utils";
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
  Tag, 
  LayoutGrid,
  ArrowLeft,
  Calendar
} from "lucide-react";
import { Link } from "@/i18n/routing";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkToc from "remark-toc";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import { ProjectHistoryChart } from "@/components/project/history-chart";
import { getTranslations } from "next-intl/server";

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

function resolveRelativeUrl(url: string, sourceUrl: string | undefined, source: string, isImage: boolean): string {
  if (!url || !sourceUrl) return url;
  if (/^(https?:\/\/|mailto:|tel:|#|data:)/i.test(url) || url.startsWith("//")) return url;

  // Clean leading ./ or /
  const cleanUrl = url.replace(/^\.?\//, "");
  const base = sourceUrl.replace(/\/$/, "");

  if (source === "github") {
    if (isImage) {
      const rawBase = base.replace("github.com", "raw.githubusercontent.com");
      return `${rawBase}/main/${cleanUrl}`;
    } else {
      return `${base}/blob/main/${cleanUrl}`;
    }
  } else if (source === "huggingface") {
    if (isImage) {
      return `${base}/resolve/main/${cleanUrl}`;
    } else {
      return `${base}/blob/main/${cleanUrl}`;
    }
  }
  return url;
}

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string; locale: string }> }) {
  const resolvedParams = await params;
  const { id: paramId, locale } = resolvedParams;
  const uuid = paramId.slice(-36);
  const project = await fetchProjectById(uuid);

  if (!project) {
    notFound();
  }

  const t = await getTranslations("ProjectDetail");
  const tNav = await getTranslations("Navigation");
  const historyData = await fetchProjectHistory(project.id, 30);
  const isGithub = project.source === "github";
  const isHuggingFace = project.source === "huggingface";
  const cleanedReadme = cleanReadme(project.readme);

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      {/* Hero Section */}
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
                {t("backBtn")}
              </Link>
              
              <div className="h-4 w-px bg-[var(--color-border)] mx-1 hidden sm:block" />
              
              <nav className="flex flex-wrap items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-48)]">
                <Link href="/" className="hover:text-[var(--color-ink)] transition-colors">
                  {tNav("trending")}
                </Link>
                <span className="text-[var(--color-border)] select-none">/</span>
                {project.categories && project.categories.length > 0 && (
                  <>
                    <Link 
                      href={`/?category=${project.categories[0].toLowerCase().replace(/\s+/g, "-")}`}
                      className="hover:text-[var(--color-ink)] transition-colors truncate max-w-[120px]"
                    >
                      {project.categories[0]}
                    </Link>
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
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 mt-1">
              <a 
                href={project.sourceUrl} 
                target="_blank" 
                rel="noopener noreferrer"
                className="apple-btn-primary py-2 px-4 text-xs flex items-center gap-1.5"
              >
                {t("visitRepo")} <ExternalLink className="h-3.5 w-3.5" />
              </a>
              {project.homepageUrl && (
                <a 
                  href={project.homepageUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="apple-btn-secondary py-2 px-4 text-xs flex items-center gap-1.5 bg-[var(--color-canvas)]"
                >
                  {t("homepage")} <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <section className="apple-tile-parchment w-full py-16 min-h-[50vh]">
        <div className="page-container max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          
          {/* Left Column: Chart & README */}
          <div className="min-w-0 space-y-8">
            
            {/* Historical Chart */}
            <div className="apple-utility-card p-6 sm:p-8">
              <h3 className="text-apple-body-strong mb-6 text-[var(--color-ink)] flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">📈</span>
                {t("growthHistory")}
              </h3>
              <div className="h-[300px]">
                <ProjectHistoryChart data={historyData} source={project.source} />
              </div>
            </div>

            {/* README */}
            {cleanedReadme ? (
              <div className="apple-utility-card p-8 sm:p-10 overflow-hidden">
                <div className="prose max-w-none prose-headings:font-semibold prose-a:text-[var(--color-action-blue)] hover:prose-a:text-[var(--color-action-blue-focus)] prose-img:rounded-xl">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, [remarkToc, { heading: 'table of contents|toc|mục lục', tight: true }]]}
                    rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
                    components={{
                      a: ({ href, children, ...props }) => (
                        <a 
                          href={resolveRelativeUrl(typeof href === "string" ? href : "", project.sourceUrl, project.source, false)} 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          {...props}
                        >
                          {children}
                        </a>
                      ),
                      img: ({ src, alt, ...props }) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img 
                          src={resolveRelativeUrl(typeof src === "string" ? src : "", project.sourceUrl, project.source, true)} 
                          alt={alt || ""} 
                          {...props} 
                        />
                      )
                    }}
                  >
                    {cleanedReadme}
                  </ReactMarkdown>
                </div>
              </div>
            ) : (
              <div className="apple-utility-card p-12 text-center flex flex-col items-center justify-center border-dashed">
                <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                  <Code2 className="h-8 w-8 text-[var(--color-ink-muted-48)]" />
                </div>
                <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">{t("noReadme")}</h3>
                <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                  {t("noReadmeDesc")}
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <aside className="space-y-6">
            
            {/* AI Summary Widget */}
            {project.aiSummary && (
              <div className="apple-utility-card p-6 bg-[var(--color-canvas)] border border-[var(--color-action-blue)]/20">
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
              <div className="apple-utility-card p-6">
                <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                  {t("classification")}
                </h3>
                {project.categories?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">{t("categories")}</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(project.categories)).map((cat: string) => (
                        <span key={cat} className="inline-flex items-center rounded-md bg-[var(--color-bg-secondary)] px-2.5 py-1 text-xs font-medium text-[var(--color-ink)] border border-[var(--color-border)]">
                          {cat}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {project.topics?.length > 0 && (
                  <div>
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">{t("topics")}</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(project.topics)).map((topic: string) => (
                        <Link 
                          key={topic} 
                          href={`/?tag=${encodeURIComponent(topic)}`}
                          className="inline-flex items-center gap-1 text-xs text-[var(--color-action-blue)] hover:underline cursor-pointer font-medium"
                        >
                          <Tag className="h-3 w-3" /> #{topic}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Timeline */}
            <div className="apple-utility-card p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                {t("timeline")}
              </h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-ink-muted-80)]">{t("created")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.sourceCreatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-[var(--color-ink-muted-80)]">{t("lastUpdated")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.updatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric' })}
                  </span>
                </div>
                <div className="flex justify-between items-center text-sm border-t border-[var(--color-divider-soft)] pt-3">
                  <span className="text-[var(--color-ink-muted-80)]">{t("lastCrawled")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {new Date(project.lastCrawledAt).toLocaleDateString(locale, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            </div>

            {/* Meta Info */}
            <div className="apple-utility-card p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                {t("metaInfo")}
              </h3>
              <ul className="space-y-4 text-sm">
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("createdOn")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.sourceCreatedAt ? new Date(project.sourceCreatedAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                  </span>
                </li>
                {project.license && (
                  <li className="flex flex-col gap-1">
                    <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("license")}</span>
                    <span className="text-[var(--color-ink)] font-medium">{project.license}</span>
                  </li>
                )}
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">{t("lastCrawled")}</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.lastCrawledAt ? new Date(project.lastCrawledAt).toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
                  </span>
                </li>
              </ul>
            </div>

          </aside>
        </div>
      </section>
    </div>
  );
}
