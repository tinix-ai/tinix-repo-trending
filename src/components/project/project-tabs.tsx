"use client";

import React, { useState } from "react";
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
  MessageCircle 
} from "lucide-react";
import { useTranslations } from "next-intl";
import { timeAgo, formatNumber } from "@/lib/utils";
import type { ProjectMention } from "@/types";

interface ProjectTabsProps {
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
  cleanedReadme,
  socialMentions,
  sourceUrl,
  source
}: ProjectTabsProps) {
  const t = useTranslations("ProjectDetail");
  const [activeTab, setActiveTab] = useState<"readme" | "mentions">("readme");
  const [currentPage, setCurrentPage] = useState(1);
  const [hoveredCoords, setHoveredCoords] = useState<Record<string, { x: number; y: number }>>({});
  
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
      </div>
    </div>
  );
}
