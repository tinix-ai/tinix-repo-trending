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
  ArrowLeft
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

export default async function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const paramId = resolvedParams.id;
  const uuid = paramId.slice(-36);
  const project = await fetchProjectById(uuid);

  if (!project) {
    notFound();
  }

  const historyData = await fetchProjectHistory(project.id, 30);
  const isGithub = project.source === "github";
  const isHuggingFace = project.source === "huggingface";
  const cleanedReadme = cleanReadme(project.readme);

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      {/* Navigation Bar */}
      <div className="w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-canvas)]">
        <div className="page-container max-w-5xl py-4">
          <Link 
            href="/" 
            className="inline-flex items-center gap-2 text-sm font-medium text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Trending
          </Link>
        </div>
      </div>

      {/* Hero Section */}
      <section className="apple-tile-light w-full py-12 lg:py-20 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="flex flex-col md:flex-row md:items-start justify-between gap-8">
            
            {/* Title & Description */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-6">
                <SourceBadge source={project.source} />
                {project.primaryLanguage && (
                  <span className="flex items-center gap-1.5 text-[12px] font-semibold tracking-wider uppercase text-[var(--color-ink-muted-80)] bg-[var(--color-bg-secondary)] px-2 py-1 rounded-md border border-[var(--color-border)]">
                    <Code2 className="h-3.5 w-3.5" />
                    {project.primaryLanguage}
                  </span>
                )}
              </div>

              <h1 className="mb-4 flex items-center gap-4 flex-wrap">
                <ProjectAvatar 
                  src={project.ownerAvatarUrl} 
                  name={project.ownerName} 
                  size={48} 
                />
                <span className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight text-[var(--color-ink)] break-all whitespace-normal">
                  {project.fullName}
                </span>
              </h1>

              <p className="text-apple-lead text-[var(--color-ink-muted-80)] max-w-3xl">
                {project.description || "No description provided for this repository."}
              </p>

              <div className="flex flex-wrap items-center gap-4 mt-8">
                <a 
                  href={project.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="apple-btn-primary flex items-center gap-2 shadow-sm"
                >
                  Visit Repository <ExternalLink className="h-4 w-4" />
                </a>
                {project.homepageUrl && (
                  <a 
                    href={project.homepageUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="apple-btn-secondary flex items-center gap-2 bg-[var(--color-canvas)] shadow-sm"
                  >
                    Homepage <ExternalLink className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>

            {/* Metrics Widget */}
            <div className="grid grid-cols-2 gap-4 shrink-0 w-full md:w-auto">
              {isGithub && (
                <>
                  <div className="apple-utility-card py-4 px-5 flex flex-col gap-1 items-start min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-apple-caption text-[var(--color-ink-muted-80)] font-semibold uppercase tracking-wider">
                      <Star className="h-4 w-4 text-[var(--color-warning)]" /> Stars
                    </span>
                    <span className="text-apple-display-md text-[var(--color-ink)] tabular-nums">
                      {formatNumber(project.stars)}
                    </span>
                  </div>
                  <div className="apple-utility-card py-4 px-5 flex flex-col gap-1 items-start min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-apple-caption text-[var(--color-ink-muted-80)] font-semibold uppercase tracking-wider">
                      <GitFork className="h-4 w-4 text-[var(--color-text-muted)]" /> Forks
                    </span>
                    <span className="text-apple-display-md text-[var(--color-ink)] tabular-nums">
                      {formatNumber(project.forks)}
                    </span>
                  </div>
                  <div className="apple-utility-card py-4 px-5 flex flex-col gap-1 items-start min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-apple-caption text-[var(--color-ink-muted-80)] font-semibold uppercase tracking-wider">
                      <CircleDot className="h-4 w-4 text-[var(--color-positive)]" /> Issues
                    </span>
                    <span className="text-apple-display-md text-[var(--color-ink)] tabular-nums">
                      {formatNumber(project.openIssues)}
                    </span>
                  </div>
                </>
              )}

              {isHuggingFace && (
                <>
                  <div className="apple-utility-card py-4 px-5 flex flex-col gap-1 items-start min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-apple-caption text-[var(--color-ink-muted-80)] font-semibold uppercase tracking-wider">
                      <Star className="h-4 w-4 text-[var(--color-warning)]" /> Likes
                    </span>
                    <span className="text-apple-display-md text-[var(--color-ink)] tabular-nums">
                      {formatNumber(project.stars)}
                    </span>
                  </div>
                  <div className="apple-utility-card py-4 px-5 flex flex-col gap-1 items-start min-w-[140px]">
                    <span className="flex items-center gap-1.5 text-apple-caption text-[var(--color-ink-muted-80)] font-semibold uppercase tracking-wider">
                      <Download className="h-4 w-4 text-[var(--color-info)]" /> Downloads
                    </span>
                    <span className="text-apple-display-md text-[var(--color-ink)] tabular-nums">
                      {formatNumber(project.downloads)}
                    </span>
                  </div>
                </>
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
            <div className="apple-utility-card p-6 sm:p-8 shadow-sm">
              <h3 className="text-apple-body-strong mb-6 text-[var(--color-ink)] flex items-center gap-2">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">📈</span>
                30-Day Growth History
              </h3>
              <div className="h-[300px]">
                <ProjectHistoryChart data={historyData} source={project.source} />
              </div>
            </div>

            {/* README */}
            {cleanedReadme ? (
              <div className="apple-utility-card p-8 sm:p-10 shadow-sm overflow-hidden">
                <div className="prose max-w-none prose-headings:font-semibold prose-a:text-[var(--color-action-blue)] hover:prose-a:text-[var(--color-action-blue-focus)] prose-img:rounded-xl">
                  <ReactMarkdown 
                    remarkPlugins={[remarkGfm, [remarkToc, { heading: 'table of contents|toc|mục lục', tight: true }]]}
                    rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
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
                <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">No README found</h3>
                <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                  We haven&apos;t indexed a README for this repository yet, or it doesn&apos;t exist.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Sidebar */}
          <aside className="space-y-6">
            
            {/* AI Summary Widget */}
            {project.aiSummary && (
              <div className="apple-utility-card p-6 bg-gradient-to-br from-[var(--color-surface-elevated)] to-[var(--color-bg-secondary)] border-[var(--color-action-blue)]/20 shadow-sm">
                <h3 className="text-apple-body-strong mb-3 flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--color-action-blue)] text-white">✨</span>
                  AI Summary
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
                  Classification
                </h3>
                         {project.categories?.length > 0 && (
                  <div className="mb-4">
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">Categories</div>
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
                    <div className="text-[11px] font-semibold text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-2">Topics</div>
                    <div className="flex flex-wrap gap-2">
                      {Array.from(new Set(project.topics)).map((topic: string) => (
                        <span key={topic} className="inline-flex items-center gap-1 text-xs text-[var(--color-action-blue)] hover:underline cursor-pointer">
                          <Tag className="h-3 w-3" /> {topic}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Meta Info */}
            <div className="apple-utility-card p-6">
              <h3 className="text-apple-body-strong mb-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-[var(--color-ink-muted-48)]" />
                Meta Information
              </h3>
              <ul className="space-y-4 text-sm">
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">Created On</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.sourceCreatedAt ? new Date(project.sourceCreatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) : 'Unknown'}
                  </span>
                </li>
                {project.license && (
                  <li className="flex flex-col gap-1">
                    <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">License</span>
                    <span className="text-[var(--color-ink)] font-medium">{project.license}</span>
                  </li>
                )}
                <li className="flex flex-col gap-1">
                  <span className="text-[var(--color-ink-muted-80)] text-xs uppercase tracking-wider font-medium">Last Crawled</span>
                  <span className="text-[var(--color-ink)] font-medium">
                    {project.lastCrawledAt ? new Date(project.lastCrawledAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recently'}
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
