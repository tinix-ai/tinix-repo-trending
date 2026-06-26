import { actionGetCollectionBySlug } from "../../../actions";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { formatNumber } from "@/lib/utils";
import {
  ChevronLeft,
  FolderHeart,
  Calendar,
  Share2,
  Sparkles,
  Lightbulb,
  Star,
  GitFork,
  Download,
  ExternalLink,
  Award,
  Globe,
  Code2,
} from "lucide-react";
import { SourceBadge } from "@/components/common/source-badge";
import { CopyLinkButton } from "@/components/common/copy-link-button";

interface PageProps {
  params: Promise<{ locale: string; slug: string }>;
}

export default async function CollectionPage({ params }: PageProps) {
  const { slug, locale } = await params;
  const collection = await actionGetCollectionBySlug(slug);

  if (!collection) {
    notFound();
  }

  const isVi = locale === "vi";
  const dateStr = new Date(collection.createdAt).toLocaleDateString(
    isVi ? "vi-VN" : "en-US",
    { year: "numeric", month: "long", day: "numeric" }
  );

  const totalStars = collection.projects.reduce((sum, p) => sum + (p.stars || 0), 0);
  const projectCount = collection.projects.length;

  // Rank medal colors
  const getRankStyle = (rank: number) => {
    if (rank === 1)
      return {
        bg: "bg-gradient-to-br from-amber-400 to-amber-600",
        text: "text-white",
        ring: "ring-amber-400/30",
        icon: "text-amber-400",
      };
    if (rank === 2)
      return {
        bg: "bg-gradient-to-br from-zinc-300 to-zinc-500",
        text: "text-white",
        ring: "ring-zinc-400/30",
        icon: "text-zinc-400",
      };
    if (rank === 3)
      return {
        bg: "bg-gradient-to-br from-amber-600 to-amber-800",
        text: "text-white",
        ring: "ring-amber-700/30",
        icon: "text-amber-600",
      };
    return {
      bg: "bg-zinc-100 dark:bg-zinc-800",
      text: "text-[var(--color-ink-muted-80)]",
      ring: "ring-zinc-200/30 dark:ring-zinc-700/30",
      icon: "text-zinc-400",
    };
  };

  return (
    <div className="w-full bg-[var(--color-bg-primary)] min-h-screen">
      {/* ── Hero ── */}
      <section className="relative w-full overflow-hidden">
        {/* Subtle gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-action-blue)]/[0.03] via-transparent to-transparent pointer-events-none" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-action-blue)_0%,transparent_60%)] opacity-[0.04] pointer-events-none" />

        <div className="relative page-container max-w-4xl mx-auto px-4 pt-8 pb-10">
          {/* Back */}
          <Link
            href="/"
            className="group inline-flex items-center gap-1.5 rounded-full border border-[var(--color-border)] bg-[var(--color-bg-secondary)] px-3 py-1.5 text-[11px] font-semibold tracking-wide uppercase text-[var(--color-ink-muted-80)] hover:text-[var(--color-action-blue)] hover:border-[var(--color-action-blue)]/30 hover:bg-[var(--color-canvas)] transition-all duration-200 mb-8"
          >
            <ChevronLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
            {isVi ? "Bảng xếp hạng" : "Leaderboard"}
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            {/* Left */}
            <div className="flex-1 space-y-4 min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full select-none">
                  <Sparkles className="w-3 h-3" />
                  {isVi ? "Tuyển chọn" : "Curated"}
                </span>
                <span className="text-[11px] text-[var(--color-ink-muted-48)] flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {dateStr}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-ink)] leading-tight">
                {collection.title}
              </h1>

              {collection.description && (
                <p className="text-sm sm:text-[15px] text-[var(--color-ink-muted-80)] leading-relaxed max-w-2xl">
                  {collection.description}
                </p>
              )}

              {/* Stats row */}
              <div className="flex items-center gap-4 pt-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-muted-80)]">
                  <FolderHeart className="w-3.5 h-3.5 text-[var(--color-action-blue)]" />
                  <span>{projectCount} {isVi ? "dự án" : "projects"}</span>
                </div>
                <div className="w-px h-3.5 bg-[var(--color-border)]" />
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-ink-muted-80)]">
                  <Star className="w-3.5 h-3.5 text-amber-500" />
                  <span>{formatNumber(totalStars)} {isVi ? "sao" : "stars"}</span>
                </div>
              </div>
            </div>

            {/* Right: Icon */}
            <div className="hidden md:flex items-center justify-center shrink-0">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--color-action-blue)]/15 to-[var(--color-action-blue)]/5 text-[var(--color-action-blue)] flex items-center justify-center border border-[var(--color-action-blue)]/10">
                <Award className="w-8 h-8" />
              </div>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-[var(--color-border)] to-transparent" />
      </section>

      {/* ── Collection List ── */}
      <main className="page-container max-w-4xl mx-auto px-4 py-10">
        <div className="space-y-4">
          {collection.projects.map((project, index) => {
            const rank = index + 1;
            const rankStyle = getRankStyle(rank);
            const isGithub = project.source === "github";
            const sourceUrl = project.sourceUrl || (isGithub
              ? `https://github.com/${project.fullName}`
              : `https://huggingface.co/${project.fullName}`);

            return (
              <div
                key={project.id}
                className="group relative"
              >
                {/* Card */}
                <div className="apple-utility-card hover-spring p-0 overflow-hidden transition-all duration-200">
                  <div className="flex">
                    {/* Rank indicator */}
                    <div className={`hidden sm:flex flex-col items-center justify-center w-16 shrink-0 border-r border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)]/40`}>
                      <div className={`w-8 h-8 rounded-full ${rankStyle.bg} ${rankStyle.text} flex items-center justify-center text-sm font-bold ring-4 ${rankStyle.ring} shadow-sm`}>
                        {rank}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 p-4 sm:p-5 min-w-0">
                      {/* Top: Avatar + Name + Source */}
                      <div className="flex items-start gap-3 mb-3">
                        {project.ownerAvatarUrl && (
                          <img
                            src={project.ownerAvatarUrl}
                            alt={project.ownerName || ""}
                            className="w-9 h-9 rounded-xl border border-[var(--color-divider-soft)] shadow-sm shrink-0 object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {/* Mobile rank */}
                            <span className={`sm:hidden inline-flex items-center justify-center w-5 h-5 rounded-full ${rankStyle.bg} ${rankStyle.text} text-[10px] font-bold`}>
                              {rank}
                            </span>
                            <Link
                              href={`/project/${project.slug.replace(/\//g, "-")}-${project.id}`}
                              className="font-bold text-[14px] text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate"
                            >
                              {project.fullName}
                            </Link>
                            <SourceBadge source={project.source} projectType={project.projectType} size="sm" />
                          </div>
                          {project.description && (
                            <p className="text-xs text-[var(--color-ink-muted-80)] mt-1 line-clamp-2 leading-relaxed">
                              {project.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Stats row */}
                      <div className="flex items-center gap-3 flex-wrap">
                        {isGithub ? (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-muted-80)] tabular-nums">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              {formatNumber(project.stars)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-muted-80)] tabular-nums">
                              <GitFork className="w-3.5 h-3.5 text-zinc-500" />
                              {formatNumber(project.forks)}
                            </span>
                          </>
                        ) : (
                          <>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-muted-80)] tabular-nums">
                              <Star className="w-3.5 h-3.5 text-amber-500" />
                              {formatNumber(project.stars)}
                            </span>
                            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-ink-muted-80)] tabular-nums">
                              <Download className="w-3.5 h-3.5 text-blue-500" />
                              {formatNumber(project.downloads)}
                            </span>
                          </>
                        )}

                        {project.primaryLanguage && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-[var(--color-ink-muted-48)]">
                            <Code2 className="w-3 h-3" />
                            {project.primaryLanguage}
                          </span>
                        )}

                        {project.license && (
                          <span className="text-[10px] font-medium text-[var(--color-ink-muted-48)] bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded">
                            {project.license}
                          </span>
                        )}

                        <div className="ml-auto flex items-center gap-2">
                          <a
                            href={sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] font-semibold text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{isVi ? "Xem" : "View"}</span>
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Curator Notes */}
                {project.curatorNotes && (
                  <div className="ml-6 sm:ml-20 mt-2 p-3.5 rounded-xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 text-xs leading-relaxed flex items-start gap-2.5">
                    <Lightbulb className="h-4 w-4 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0 select-none" />
                    <div className="min-w-0">
                      <strong className="text-[var(--color-ink)] font-bold text-[11px] uppercase tracking-wider block mb-0.5">
                        {isVi ? "Nhận xét:" : "Insight:"}
                      </strong>
                      <p className="text-[var(--color-ink-muted-80)]">
                        {project.curatorNotes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── Share CTA ── */}
        <div className="mt-14 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--color-action-blue)]/[0.04] to-transparent rounded-2xl pointer-events-none" />
          <div className="relative apple-utility-card p-8 sm:p-10 text-center space-y-5 max-w-lg mx-auto">
            <div className="w-12 h-12 rounded-full bg-[var(--color-action-blue)]/10 flex items-center justify-center mx-auto">
              <Share2 className="w-5 h-5 text-[var(--color-action-blue)]" />
            </div>

            <div className="space-y-2">
              <h3 className="text-lg font-bold text-[var(--color-ink)]">
                {isVi ? "Chia sẻ bộ sưu tập này" : "Share this Collection"}
              </h3>
              <p className="text-sm text-[var(--color-ink-muted-80)] max-w-sm mx-auto leading-relaxed">
                {isVi
                  ? "Giúp cộng đồng khám phá những dự án nguồn mở tuyệt vời này bằng cách chia sẻ lên mạng xã hội."
                  : "Help the community discover these amazing open-source projects by sharing on social media."}
              </p>
            </div>

            <div className="flex items-center justify-center gap-3 pt-1">
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(collection.title)}&url=${encodeURIComponent(`https://tinix.dev/${locale}/collection/${slug}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#1DA1F2] hover:bg-[#1a91da] rounded-lg transition-colors cursor-pointer"
              >
                <Globe className="w-3.5 h-3.5" />
                Twitter / X
              </a>
              <CopyLinkButton
                url={`https://tinix.dev/${locale}/collection/${slug}`}
                label={isVi ? "Sao chép link" : "Copy Link"}
                copiedLabel={isVi ? "Đã sao chép!" : "Copied!"}
              />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
