"use client";

import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkToc from "remark-toc";
import rehypeHighlight from "rehype-highlight";
import rehypeSlug from "rehype-slug";
import rehypeRaw from "rehype-raw";
import "highlight.js/styles/github-dark.css";
import { 
  Code2, 
  MessageSquare, 
  ExternalLink, 
  User, 
  TrendingUp, 
  MessageCircle,
  Star,
  ShieldAlert
} from "lucide-react";
import { useTranslations } from "next-intl";
import { timeAgo, formatNumber } from "@/lib/utils";
import type { ProjectMention } from "@/types";
import { Link } from "@/i18n/routing";

interface ProjectTabsProps {
  projectId: string;
  cleanedReadme: string;
  socialMentions: ProjectMention[];
  sourceUrl: string | undefined;
  source: string;
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

export function ProjectTabs({
  projectId,
  cleanedReadme,
  socialMentions,
  sourceUrl,
  source
}: ProjectTabsProps) {
  const t = useTranslations("ProjectDetail");
  const [activeTab, setActiveTab] = useState<"readme" | "mentions" | "reviews">("readme");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredCoords, setHoveredCoords] = useState<Record<string, { x: number; y: number }>>({});
  
  const [reviews, setReviews] = useState<any[]>([]);
  const [session, setSession] = useState<any>(null);
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewInput, setReviewInput] = useState("");
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false }));
  }, []);

  const fetchReviews = () => {
    setReviewsLoading(true);
    fetch(`/api/projects/${projectId}/reviews`)
      .then((res) => res.json())
      .then((data) => {
        setReviews(data || []);
        setReviewsLoading(false);
      })
      .catch((err) => {
        console.error("Error fetching reviews", err);
        setReviewsLoading(false);
      });
  };

  useEffect(() => {
    if (activeTab === "reviews") {
      fetchReviews();
    }
  }, [activeTab, projectId]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitLoading(true);
    setReviewError(null);

    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rating: ratingInput, reviewText: reviewInput }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Không thể gửi đánh giá");
      }

      setReviewInput("");
      fetchReviews();
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  const itemsPerPage = 10;
  const totalPages = Math.ceil(socialMentions.length / itemsPerPage);
  
  const handleMouseMove = (mentionId: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setHoveredCoords((prev) => ({
      ...prev,
      [mentionId]: { x, y },
    }));
  };

  const getSourceIcon = (mentionSource: string) => {
    switch (mentionSource) {
      case 'reddit':
        return <span className="text-orange-500 font-bold text-xs uppercase bg-orange-500/10 border border-orange-500/20 px-2.5 py-0.5 rounded-full select-none">Reddit</span>;
      case 'x':
        return <span className="text-[var(--color-ink)] font-bold text-xs bg-[var(--color-ink)]/5 border border-[var(--color-ink)]/10 px-2.5 py-0.5 rounded-full select-none">X (Twitter)</span>;
      case 'hacker_news':
        return <span className="text-amber-600 font-bold text-xs uppercase bg-amber-600/10 border border-amber-600/20 px-2.5 py-0.5 rounded-full select-none">Hacker News</span>;
      default:
        return null;
    }
  };

  const paginatedMentions = socialMentions.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="min-w-0 space-y-6">
      {/* Dynamic Glass Tabs Navigation */}
      <div className="flex items-center gap-1.5 p-1 bg-[var(--color-bg-secondary)] rounded-xl w-fit border border-[var(--color-divider-soft)] shadow-sm">
        <button
          onClick={() => setActiveTab("readme")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "readme"
              ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
          }`}
        >
          <Code2 className="w-4 h-4 text-blue-500" />
          {t("readmeTab")}
        </button>
        <button
          onClick={() => {
            setActiveTab("mentions");
            setCurrentPage(1);
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "mentions"
              ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
          }`}
        >
          <MessageSquare className="w-4 h-4 text-emerald-500" />
          <span>{t("mentionsTab")}</span>
          {socialMentions.length > 0 && (
            <span className="flex h-5 items-center justify-center rounded-full bg-[var(--color-accent-dim)] border border-[var(--color-border)] px-1.5 text-[10px] font-bold text-[var(--color-action-blue)] leading-none select-none">
              {socialMentions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => {
            setActiveTab("reviews");
          }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
            activeTab === "reviews"
              ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]"
              : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
          }`}
        >
          <Star className="w-4 h-4 text-[var(--color-warning)]" />
          <span>Đánh giá</span>
          {reviews.length > 0 && (
            <span className="flex h-5 items-center justify-center rounded-full bg-[var(--color-accent-dim)] border border-[var(--color-border)] px-1.5 text-[10px] font-bold text-[var(--color-action-blue)] leading-none select-none">
              {reviews.length}
            </span>
          )}
        </button>
      </div>

      {/* Tabs Content */}
      <div className="transition-opacity duration-300">
        {activeTab === "readme" && (
          cleanedReadme ? (
            <div className="apple-utility-card p-8 sm:p-10 overflow-hidden animate-fade-in-up">
              <div className="prose max-w-none prose-headings:font-semibold prose-a:text-[var(--color-action-blue)] hover:prose-a:text-[var(--color-action-blue-focus)] prose-img:rounded-xl">
                <ReactMarkdown 
                  remarkPlugins={[remarkGfm, [remarkToc, { heading: 'table of contents|toc|mục lục', tight: true }]]}
                  rehypePlugins={[rehypeRaw, rehypeSlug, rehypeHighlight]}
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a 
                        href={resolveRelativeUrl(typeof href === "string" ? href : "", sourceUrl, source, false)} 
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
                        src={resolveRelativeUrl(typeof src === "string" ? src : "", sourceUrl, source, true)} 
                        alt={alt || ""} 
                        {...props} 
                      />
                    ),
                    /* eslint-disable @typescript-eslint/no-unused-vars */
                    td: ({ node, vAlign, valign, ...props }: React.ComponentPropsWithoutRef<"td"> & { node?: unknown; vAlign?: unknown; valign?: unknown }) => <td {...props} />,
                    th: ({ node, vAlign, valign, ...props }: React.ComponentPropsWithoutRef<"th"> & { node?: unknown; vAlign?: unknown; valign?: unknown }) => <th {...props} />,
                    tr: ({ node, vAlign, valign, ...props }: React.ComponentPropsWithoutRef<"tr"> & { node?: unknown; vAlign?: unknown; valign?: unknown }) => <tr {...props} />
                    /* eslint-enable @typescript-eslint/no-unused-vars */
                  }}
                >
                  {cleanedReadme}
                </ReactMarkdown>
              </div>
            </div>
          ) : (
            <div className="apple-utility-card p-12 text-center flex flex-col items-center justify-center border-dashed animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                <Code2 className="h-8 w-8 text-[var(--color-ink-muted-48)]" />
              </div>
              <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">{t("noReadme")}</h3>
              <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                {t("noReadmeDesc")}
              </p>
            </div>
          )
        )}

        {activeTab === "mentions" && (
          socialMentions.length > 0 ? (
            <div className="space-y-6 animate-fade-in-up">
              <div className="grid grid-cols-1 gap-6">
                {paginatedMentions.map((mention) => (
                  <div
                    key={mention.id}
                    onMouseMove={(e) => handleMouseMove(mention.id, e)}
                    className="apple-utility-card hover-spring glow-interactive p-6 flex flex-col justify-between relative overflow-hidden group cursor-pointer"
                    style={{
                      "--mouse-x": `${hoveredCoords[mention.id]?.x || 0}px`,
                      "--mouse-y": `${hoveredCoords[mention.id]?.y || 0}px`,
                    } as React.CSSProperties}
                  >
                    {/* Header info */}
                    <div className="flex items-center justify-between gap-4 mb-4 relative z-10">
                      <div className="flex items-center gap-2">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-ink-muted-80)] select-none">
                          <User className="h-4 w-4" />
                        </div>
                        <div className="flex flex-col">
                          <span className="text-sm font-bold text-[var(--color-ink)]">
                            @{mention.author.split('/').pop()}
                          </span>
                          <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider font-semibold">
                            {timeAgo(mention.mentionedAt)}
                          </span>
                        </div>
                      </div>
                      {getSourceIcon(mention.source)}
                    </div>

                    {/* Content text */}
                    <div className="flex-1 mb-6 relative z-10">
                      <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed whitespace-pre-wrap break-words">
                        {mention.content}
                      </p>
                    </div>

                    {/* Footer stats & links */}
                    <div className="flex items-center justify-between border-t border-[var(--color-divider-soft)] pt-4 relative z-10 mt-auto">
                      <div className="flex items-center gap-4 text-xs font-semibold tabular-nums text-[var(--color-ink-muted-80)]">
                        <span className="flex items-center gap-1 select-none">
                          <TrendingUp className="h-3.5 w-3.5 text-blue-500" />
                          {formatNumber(mention.score)}
                        </span>
                        <span className="flex items-center gap-1 select-none">
                          <MessageCircle className="h-3.5 w-3.5 text-zinc-500" />
                          {formatNumber(mention.commentsCount)}
                        </span>
                      </div>
                      <a 
                        href={mention.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[var(--color-action-blue)] hover:text-[var(--color-action-blue-focus)] hover:underline text-xs font-bold"
                      >
                        <span>Original Post</span>
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-semibold text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-elevated)] transition-colors cursor-pointer select-none"
                  >
                    {t("previous") || "Previous"}
                  </button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`w-8 h-8 rounded-lg text-sm font-semibold transition-colors cursor-pointer select-none ${
                          currentPage === page 
                            ? "bg-[var(--color-action-blue)] text-white" 
                            : "text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages}
                    className="px-4 py-2 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-sm font-semibold text-[var(--color-ink)] disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[var(--color-surface-elevated)] transition-colors cursor-pointer select-none"
                  >
                    {t("next") || "Next"}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="apple-utility-card p-12 text-center flex flex-col items-center justify-center border-dashed animate-fade-in-up">
              <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-4">
                <MessageSquare className="h-8 w-8 text-[var(--color-ink-muted-48)]" />
              </div>
              <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-2">{t("noSocialMentions")}</h3>
              <p className="text-[var(--color-ink-muted-80)] text-sm max-w-sm">
                {t("noSocialMentionsDesc")}
              </p>
            </div>
          )
        )}

        {activeTab === "reviews" && (
          <div className="space-y-8 animate-fade-in-up">
            {/* Reviews Summary Stats Card */}
            {(() => {
              const avgRating = reviews.length > 0
                ? (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1)
                : "0.0";
              
              const ratingCounts = [0, 0, 0, 0, 0];
              reviews.forEach(r => {
                const star = r.rating;
                if (star >= 1 && star <= 5) {
                  ratingCounts[5 - star]++;
                }
              });

              return (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-6 shadow-sm">
                  {/* Avg rating */}
                  <div className="flex flex-col items-center justify-center text-center p-4 border-b md:border-b-0 md:border-r border-[var(--color-divider-soft)]">
                    <span className="text-5xl font-extrabold text-[var(--color-ink)] leading-none tracking-tight">
                      {avgRating}
                    </span>
                    <div className="flex items-center gap-0.5 mt-2.5">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          className={
                            star <= Math.round(Number(avgRating))
                              ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                              : "text-[var(--color-ink-muted-48)]"
                          }
                        />
                      ))}
                    </div>
                    <span className="text-xs text-[var(--color-ink-muted-64)] font-medium mt-2">
                      {reviews.length} đánh giá từ cộng đồng
                    </span>
                  </div>

                  {/* Bars distribution chart */}
                  <div className="md:col-span-2 flex flex-col justify-center gap-2 p-2">
                    {[5, 4, 3, 2, 1].map((stars) => {
                      const count = ratingCounts[5 - stars];
                      const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
                      return (
                        <div key={stars} className="flex items-center gap-3 text-xs">
                          <span className="w-8 text-[var(--color-ink-muted-80)] font-semibold text-right shrink-0">
                            {stars} ★
                          </span>
                          <div className="flex-1 h-2 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[var(--color-warning)] rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="w-8 text-[var(--color-ink-muted-48)] tabular-nums text-left shrink-0">
                            {count}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })()}

            {/* Submit a Review Form */}
            <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-6 shadow-sm">
              <h4 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-wider mb-4">
                Viết đánh giá của bạn
              </h4>
              
              {session?.authenticated ? (
                <form onSubmit={handleSubmitReview} className="space-y-4">
                  {reviewError && (
                    <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs animate-fade-in">
                      <ShieldAlert className="shrink-0 mt-0.5" size={16} />
                      <span>{reviewError}</span>
                    </div>
                  )}

                  {/* Rating Stars Input */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-[var(--color-ink-muted-80)] font-semibold mr-1">Đánh giá sao:</span>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRatingInput(star)}
                        onMouseEnter={() => setHoverRating(star)}
                        onMouseLeave={() => setHoverRating(null)}
                        className="cursor-pointer text-[var(--color-ink-muted-48)] hover:scale-110 transition-transform focus:outline-none"
                      >
                        <Star
                          size={24}
                          className={
                            star <= (hoverRating ?? ratingInput)
                              ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                              : "text-[var(--color-ink-muted-48)]"
                          }
                        />
                      </button>
                    ))}
                  </div>

                  {/* Review Text */}
                  <div className="space-y-1.5">
                    <textarea
                      value={reviewInput}
                      onChange={(e) => setReviewInput(e.target.value)}
                      placeholder="Chia sẻ nhận xét của bạn về dự án này..."
                      rows={4}
                      maxLength={1000}
                      disabled={submitLoading}
                      className="w-full p-4 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)]/50 focus:outline-none focus:border-[var(--color-action-blue)] transition-colors resize-none"
                    />
                    <div className="text-right text-[10px] text-[var(--color-ink-muted-48)]">
                      {reviewInput.length} / 1000 ký tự
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={submitLoading}
                    className="px-5 py-2 bg-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/90 text-white rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {submitLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      "Gửi đánh giá"
                    )}
                  </button>
                </form>
              ) : session !== null ? (
                <div className="flex flex-col items-center justify-center p-6 text-center bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] border-dashed rounded-xl">
                  <ShieldAlert className="text-[var(--color-ink-muted-48)] mb-2.5" size={24} />
                  <p className="text-xs text-[var(--color-ink-muted-80)] font-semibold mb-3">
                    Bạn cần đăng nhập để chấm điểm và đánh giá dự án
                  </p>
                  <Link
                    href={`/login?callbackUrl=/project/${projectId}`}
                    className="px-4 py-2 bg-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/90 text-white rounded-lg text-xs font-semibold transition-all shadow-sm"
                  >
                    Đăng nhập ngay
                  </Link>
                </div>
              ) : (
                <div className="h-20 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-[var(--color-action-blue)]/30 border-t-[var(--color-action-blue)] rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Community Reviews List */}
            <div className="space-y-4">
              <h4 className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-wider">
                Đánh giá mới nhất
              </h4>

              {reviewsLoading ? (
                <div className="flex items-center justify-center py-10 gap-2.5 text-[var(--color-ink-muted-48)] text-sm">
                  <div className="w-5 h-5 border-2 border-[var(--color-action-blue)]/30 border-t-[var(--color-action-blue)] rounded-full animate-spin" />
                  Đang tải đánh giá…
                </div>
              ) : reviews.length > 0 ? (
                <div className="grid grid-cols-1 gap-4">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="apple-utility-card p-5 flex flex-col justify-between relative overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-4 mb-3">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-ink-muted-80)]">
                            <User className="h-4 w-4" />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[var(--color-ink)]">
                              @{rev.user.username}
                            </span>
                            <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider font-semibold">
                              {timeAgo(rev.createdAt)}
                            </span>
                          </div>
                        </div>

                        {/* Stars */}
                        <div className="flex items-center gap-0.5">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              size={12}
                              className={
                                star <= rev.rating
                                  ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                                  : "text-[var(--color-ink-muted-48)]"
                              }
                            />
                          ))}
                        </div>
                      </div>

                      {rev.reviewText && (
                        <p className="text-xs text-[var(--color-ink-muted-80)] leading-relaxed whitespace-pre-wrap break-words">
                          {rev.reviewText}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="apple-utility-card p-10 text-center flex flex-col items-center justify-center border-dashed">
                  <div className="w-12 h-12 rounded-full bg-[var(--color-bg-secondary)] flex items-center justify-center mb-3">
                    <Star className="h-6 w-6 text-[var(--color-ink-muted-48)]" />
                  </div>
                  <h5 className="text-xs font-bold text-[var(--color-ink)] mb-1">Chưa có đánh giá nào</h5>
                  <p className="text-[11px] text-[var(--color-ink-muted-80)] max-w-xs leading-normal">
                    Hãy là người đầu tiên đưa ra điểm số và nhận xét cho dự án này!
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
