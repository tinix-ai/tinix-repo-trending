"use client";

import { useState, useEffect } from "react";
import type { RankedProject } from "@/types";
import { X, Copy, Check, Share2, ExternalLink, Code } from "lucide-react";

interface ShareModalProps {
  project: RankedProject;
  days: number;
  isOpen: boolean;
  onClose: () => void;
}

export function ShareModal({ project, days, isOpen, onClose }: ShareModalProps) {
  const [copied, setCopied] = useState<string | null>(null);
  const [origin, setOrigin] = useState("https://tinix-repo-trending.vercel.app");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  if (!isOpen) return null;

  const projectSlug = project.slug.replace(/\//g, "-");
  const projectUrl = `${origin}/project/${projectSlug}-${project.id}`;
  const badgeUrl = `${origin}/api/badge/${project.id}?days=${days}`;
  
  const periodLabel = days === 7 ? "Tuần" : days === 30 ? "Tháng" : "Ngày";
  const periodSlug = days === 7 ? "weekly" : days === 30 ? "monthly" : "daily";

  const markdownCode = `[![Tinix Trending](${badgeUrl})](${projectUrl})`;
  const htmlCode = `<a href="${projectUrl}" target="_blank"><img src="${badgeUrl}" alt="Tinix Trending Badge" /></a>`;
  
  const shareText = `🔥 Dự án ${project.fullName} đang xếp hạng #${project.rank} trên Bảng xếp hạng Xu hướng ${periodLabel} của Tinix! Hãy xem và ủng hộ tại:`;
  const tweetText = `🔥 Dự án ${project.fullName} đang xếp hạng #${project.rank} trên Bảng xếp hạng Xu hướng ${periodLabel} của Tinix! 🚀 Xem chi tiết tại: ${projectUrl} #tinix #opensource`;

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  const shareOnX = () => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  const shareOnLinkedIn = () => {
    window.open(
      `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(projectUrl)}`,
      "_blank",
      "noopener,noreferrer"
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
      {/* Backdrop click to close */}
      <div className="absolute inset-0" onClick={onClose}></div>

      {/* Modal Card */}
      <div className="relative w-full max-w-lg overflow-hidden bg-white dark:bg-[#1C1C1E] border border-[var(--color-border)] rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--color-divider-soft)]">
          <div className="flex items-center gap-2">
            <Share2 className="h-5 w-5 text-[var(--color-action-blue)]" />
            <h3 className="text-[17px] font-semibold text-[var(--color-ink)]">
              Chia sẻ & PR dự án
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-[var(--color-surface-pearl)] transition-colors text-[var(--color-ink-muted-80)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
          {/* Badge Preview */}
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
              Badge Trạng Thái (Live Preview)
            </span>
            <div className="flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-900/50 rounded-xl border border-dashed border-[var(--color-hairline)]">
              <img
                src={badgeUrl}
                alt="Tinix Trending Badge"
                className="select-none pointer-events-none filter drop-shadow-sm"
              />
            </div>
          </div>

          {/* Copy Markdown Badge */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
                Markdown Code (Dán vào GitHub README)
              </span>
              <button
                onClick={() => copyToClipboard(markdownCode, "markdown")}
                className="flex items-center gap-1 text-xs text-[var(--color-action-blue)] font-medium hover:underline"
              >
                {copied === "markdown" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Sao chép
                  </>
                )}
              </button>
            </div>
            <div className="relative">
              <textarea
                readOnly
                value={markdownCode}
                rows={2}
                className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-[var(--color-hairline)] text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] resize-none"
              />
            </div>
          </div>

          {/* HTML Code */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
                HTML Code (Dán vào Website/Blogs)
              </span>
              <button
                onClick={() => copyToClipboard(htmlCode, "html")}
                className="flex items-center gap-1 text-xs text-[var(--color-action-blue)] font-medium hover:underline"
              >
                {copied === "html" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Sao chép
                  </>
                )}
              </button>
            </div>
            <textarea
              readOnly
              value={htmlCode}
              rows={2}
              className="w-full p-3 text-xs font-mono rounded-lg bg-slate-50 dark:bg-slate-900 border border-[var(--color-hairline)] text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] resize-none"
            />
          </div>

          {/* Social share buttons */}
          <div className="space-y-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
              Chia sẻ mạng xã hội
            </span>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={shareOnX}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-black hover:bg-black/90 dark:bg-white dark:text-black dark:hover:bg-white/90 rounded-xl transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
                </svg>
                Chia sẻ trên X
              </button>
              <button
                onClick={shareOnLinkedIn}
                className="flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#0077B5] hover:bg-[#0077B5]/90 rounded-xl transition-colors cursor-pointer"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/>
                </svg>
                LinkedIn
              </button>
            </div>
          </div>

          {/* Copy Post Text Template */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)]">
                Mẫu tin đăng thảo luận (Copy & Post)
              </span>
              <button
                onClick={() => copyToClipboard(`${shareText} ${projectUrl}`, "template")}
                className="flex items-center gap-1 text-xs text-[var(--color-action-blue)] font-medium hover:underline"
              >
                {copied === "template" ? (
                  <>
                    <Check className="h-3.5 w-3.5" /> Đã chép
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" /> Sao chép mẫu
                  </>
                )}
              </button>
            </div>
            <div className="p-3 text-xs bg-slate-50 dark:bg-slate-900 border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] leading-relaxed select-all">
              <p>{shareText}</p>
              <p className="text-[var(--color-action-blue)] underline truncate font-mono mt-1">{projectUrl}</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-[var(--color-divider-soft)] bg-slate-50 dark:bg-slate-900/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-slate-200 hover:bg-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 text-[var(--color-ink)] transition-colors cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
}
