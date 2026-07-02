"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { PenSquare, Eye, Clock, Trash2, Edit, Send, CheckCircle2, XCircle, FileText, Loader2, AlertCircle } from "lucide-react";
import Link from "next/link";
import { actionSubmitPost, actionDeletePost } from "@/app/actions/blog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface Post {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  rejectionReason: string | null;
}

const filterKeys = ["all", "draft", "pending", "published", "rejected"] as const;
type FilterType = typeof filterKeys[number];

export function UserPosts({ posts, locale }: { posts: Post[]; locale: string }) {
  const t = useTranslations("Blog");
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("all");
  const [isPending, startTransition] = useTransition();
  const [loadingPostId, setLoadingPostId] = useState<string | null>(null);

  const filteredPosts = posts.filter((p) => filter === "all" || p.status === filter);

  const filterLabelMap: Record<FilterType, string> = {
    all: t("filterAll"),
    draft: t("filterDraft"),
    pending: t("filterPending"),
    published: t("filterPublished"),
    rejected: t("filterRejected"),
  };

  const handleDelete = async (id: string) => {
    if (!confirm(t("confirmDelete"))) return;
    setLoadingPostId(id);
    startTransition(async () => {
      const res = await actionDeletePost(id);
      setLoadingPostId(null);
      if (res.success) {
        toast.success(t("toastDeleted"));
        router.refresh();
      } else {
        toast.error(res.error || t("toastDeleteError"));
      }
    });
  };

  const handleSubmit = async (id: string) => {
    setLoadingPostId(id);
    startTransition(async () => {
      const res = await actionSubmitPost(id);
      setLoadingPostId(null);
      if (res.success) {
        toast.success(t("toastSubmitted"));
        router.refresh();
      } else {
        toast.error(res.error || t("toastSubmitError"));
      }
    });
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header and Create Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        {/* Filters */}
        <div className="flex flex-wrap gap-2">
          {filterKeys.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                filter === f
                  ? "bg-[var(--color-ink)] text-[var(--color-bg-primary)] border-[var(--color-ink)]"
                  : "bg-[var(--color-bg-secondary)]/50 border-[var(--color-divider-soft)] text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]"
              }`}
            >
              {filterLabelMap[f]} ({f === "all" ? posts.length : posts.filter((p) => p.status === f).length})
            </button>
          ))}
        </div>

        <Link
          href={`/${locale}/profile/blog/new`}
          className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white text-xs font-semibold rounded-lg hover:bg-[var(--color-primary)]/90 transition-all shadow-sm hover:shadow"
        >
          <PenSquare className="w-4 h-4" />
          {t("writeStory")}
        </Link>
      </div>

      {filteredPosts.length === 0 ? (
        <div className="glass-card p-12 text-center flex flex-col items-center">
          <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] flex items-center justify-center mb-4">
            <FileText className="w-8 h-8 text-[var(--color-ink-muted-48)]" />
          </div>
          <h3 className="text-lg font-bold text-[var(--color-ink)] mb-1">{t("noStories")}</h3>
          <p className="text-xs text-[var(--color-ink-muted)] max-w-sm mb-6">
            {t("noStoriesDesc", { filter: filter !== "all" ? filterLabelMap[filter].toLowerCase() : "" })}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {filteredPosts.map((post) => (
            <div key={post.id} className="glass-card p-5 flex flex-col sm:flex-row gap-5 items-start sm:items-center border border-[var(--color-divider-soft)]">
              <div className="flex-1 min-w-0">
                <h4 className="text-base font-bold text-[var(--color-ink)] truncate mb-1">
                  {post.status === "published" ? (
                    <Link href={`/${locale}/blog/${post.slug}`} className="hover:text-[var(--color-primary)] transition-colors">
                      {post.title}
                    </Link>
                  ) : (
                    post.title
                  )}
                </h4>
                
                {/* Status Badges */}
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <div className="flex items-center gap-1">
                    {post.status === "published" ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-status-success)] bg-[var(--color-status-success)]/10 px-2 py-0.5 rounded font-semibold text-[10px] uppercase">
                        <CheckCircle2 className="w-3 h-3" />
                        {t("statusPublished")}
                      </span>
                    ) : post.status === "pending" ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-status-warning)] bg-[var(--color-status-warning)]/10 px-2 py-0.5 rounded font-semibold text-[10px] uppercase">
                        <Clock className="w-3 h-3" />
                        {t("statusPending")}
                      </span>
                    ) : post.status === "rejected" ? (
                      <span className="inline-flex items-center gap-1 text-[var(--color-status-error)] bg-[var(--color-status-error)]/10 px-2 py-0.5 rounded font-semibold text-[10px] uppercase">
                        <XCircle className="w-3 h-3" />
                        {t("statusRejected")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[var(--color-ink-muted)] bg-[var(--color-bg-secondary)] px-2 py-0.5 rounded font-semibold text-[10px] uppercase border border-[var(--color-divider-soft)]">
                        {t("statusDraft")}
                      </span>
                    )}
                  </div>
                  
                  <span className="text-[var(--color-ink-muted)]">
                    {t("createdAt", { date: new Date(post.createdAt).toLocaleDateString() })}
                  </span>
                  
                  {post.status === "published" && (
                    <span className="flex items-center gap-1 text-[var(--color-ink-muted)]">
                      <Eye className="w-3.5 h-3.5" />
                      {t("views", { count: post.views })}
                    </span>
                  )}
                </div>

                {/* Rejection Feedback */}
                {post.status === "rejected" && post.rejectionReason && (
                  <div className="mt-3 p-3 bg-red-500/5 text-red-500 rounded-lg text-xs flex gap-2 border border-red-500/10">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                    <div>
                      <strong>{t("adminFeedback")}</strong> {post.rejectionReason}
                    </div>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 mt-4 sm:mt-0 w-full sm:w-auto justify-end">
                {/* Submit button for draft/rejected */}
                {(post.status === "draft" || post.status === "rejected") && (
                  <button
                    onClick={() => handleSubmit(post.id)}
                    disabled={loadingPostId === post.id}
                    className="h-8 px-3 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                  >
                    {loadingPostId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                    {t("submitForReview")}
                  </button>
                )}

                {/* Edit button */}
                {post.status !== "pending" && (
                  <Link
                    href={`/${locale}/profile/blog/edit/${post.id}`}
                    className="h-8 w-8 rounded-lg border border-[var(--color-divider-strong)] text-[var(--color-ink)] flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors"
                  >
                    <Edit className="w-3.5 h-3.5" />
                  </Link>
                )}

                {/* Delete button */}
                <button
                  onClick={() => handleDelete(post.id)}
                  disabled={loadingPostId === post.id}
                  className="h-8 w-8 rounded-lg border border-red-500/20 text-red-500 flex items-center justify-center hover:bg-red-500/10 transition-colors disabled:opacity-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
