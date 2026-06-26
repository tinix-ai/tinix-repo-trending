import { actionGetCollectionBySlug } from "../../../actions";
import { notFound } from "next/navigation";
import { Link } from "@/i18n/routing";
import { ProjectCard } from "@/components/leaderboard/project-card";
import { ChevronLeft, FolderHeart, Calendar, Share2, Sparkles, Lightbulb } from "lucide-react";
import type { RankedProject } from "@/types";

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
  const dateStr = new Date(collection.createdAt).toLocaleDateString(isVi ? "vi-VN" : "en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="w-full bg-[var(--color-canvas)] min-h-screen pb-16">
      {/* Top Banner/Hero */}
      <section className="apple-tile-light w-full pt-8 pb-10 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-4xl mx-auto px-4">
          {/* Back button */}
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-[var(--color-action-blue)] font-medium hover:underline mb-6 group"
          >
            <ChevronLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
            {isVi ? "Quay lại Bảng xếp hạng" : "Back to Leaderboard"}
          </Link>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
            <div className="flex-1 space-y-4">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  {isVi ? "Tuyển chọn" : "Curated"}
                </span>
                <span className="text-[11px] text-[var(--color-ink-muted-80)] flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" />
                  {dateStr}
                </span>
              </div>

              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-[var(--color-ink)] leading-tight">
                {collection.title}
              </h1>

              {collection.description && (
                <p className="text-[16px] text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
                  {collection.description}
                </p>
              )}
            </div>

            {/* Icon / Side details */}
            <div className="flex items-center gap-3 shrink-0 md:pt-2">
              <div className="w-12 h-12 rounded-2xl bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] flex items-center justify-center shadow-inner">
                <FolderHeart className="w-6 h-6" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Main List */}
      <main className="page-container max-w-3xl mx-auto px-4 mt-10">
        <div className="space-y-8">
          {collection.projects.map((project, index) => {
            const rankedProj = {
              ...project,
              rank: index + 1, // Override rank to represent collection order
              score: 0,
              starsGained: 0,
              forksGained: 0,
              velocityScore: 0,
              momentumScore: 0,
              tags: [],
              sparklineData: [],
              sourceId: project.id,
              ownerType: "user" as const,
              openIssues: 0,
              watchers: 0,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              sourceCreatedAt: new Date().toISOString(),
              lastCrawledAt: new Date().toISOString(),
            } as unknown as RankedProject;

            return (
              <div key={project.id} className="group flex flex-col gap-3 relative animate-fade-in-up">
                {/* Visual Connector Line */}
                {index < collection.projects.length - 1 && (
                  <div className="absolute left-[20px] top-[48px] bottom-[-32px] w-0.5 bg-dashed border-l border-dashed border-[var(--color-divider-soft)] hidden md:block"></div>
                )}

                {/* Project Item */}
                <div className="flex-1">
                  <ProjectCard project={rankedProj} index={index} days={1} />
                </div>

                {/* Curator Comments */}
                {project.curatorNotes && (
                  <div className="ml-10 md:ml-14 p-4 rounded-2xl bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/10 dark:border-amber-500/20 text-xs text-[var(--color-text-primary)] leading-relaxed relative flex items-start gap-2 shadow-sm">
                    <Lightbulb className="h-4.5 w-4.5 text-amber-500 dark:text-amber-400 mt-0.5 shrink-0 select-none" />
                    <div>
                      <strong className="text-[var(--color-ink)] font-bold block mb-0.5">
                        {isVi ? "Lời khuyên của chuyên gia:" : "Curator's Insight:"}
                      </strong>
                      <p className="text-[var(--color-text-secondary)]">{project.curatorNotes}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Footer Share Prompt */}
        <div className="mt-16 p-8 rounded-3xl bg-[var(--color-canvas-parchment)] border border-[var(--color-divider-soft)] text-center space-y-4 max-w-xl mx-auto shadow-sm">
          <Share2 className="w-8 h-8 text-[var(--color-action-blue)] mx-auto animate-pulse" />
          <h3 className="text-lg font-bold text-[var(--color-ink)]">
            {isVi ? "Thích bộ sưu tập này?" : "Like this Collection?"}
          </h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {isVi 
              ? "Hãy sao chép link trang này và chia sẻ nó lên X/Twitter, LinkedIn hoặc cộng đồng lập trình của bạn để PR cho các dự án nguồn mở tuyệt vời này nhé!"
              : "Copy the link of this page and share it on X/Twitter, LinkedIn, or your dev communities to promote these awesome open-source projects!"}
          </p>
        </div>
      </main>
    </div>
  );
}
