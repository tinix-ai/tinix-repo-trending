"use client";

import { useState, useTransition, useEffect } from "react";
import { CheckCircle2, XCircle, FileText, Loader2, MessageSquare, AlertTriangle, Eye, ArrowUpRight } from "lucide-react";
import { actionApprovePost, actionRejectPost } from "@/app/actions/blog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface PendingPost {
  id: string;
  title: string;
  slug: string;
  createdAt: Date;
  author: {
    username: string;
  };
}

export function BlogModerationManager() {
  const router = useRouter();
  const [posts, setPosts] = useState<PendingPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();
  const [actionPostId, setActionPostId] = useState<string | null>(null);
  const [rejectingPostId, setRejectingPostId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const fetchPending = async () => {
    try {
      const res = await fetch("/api/admin/blog/pending");
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (err) {
      console.error("Failed to fetch pending blog posts:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPending();
  }, []);

  const handleApprove = async (id: string) => {
    setActionPostId(id);
    startTransition(async () => {
      const res = await actionApprovePost(id);
      setActionPostId(null);
      if (res.success) {
        toast.success("Post approved and published!");
        fetchPending();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to approve post.");
      }
    });
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      toast.error("Please provide a rejection reason.");
      return;
    }

    const id = rejectingPostId!;
    setActionPostId(id);
    startTransition(async () => {
      const res = await actionRejectPost(id, rejectReason);
      setActionPostId(null);
      setRejectingPostId(null);
      setRejectReason("");
      if (res.success) {
        toast.success("Post rejected.");
        fetchPending();
        router.refresh();
      } else {
        toast.error(res.error || "Failed to reject post.");
      }
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-[var(--color-ink-muted)]">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {posts.length === 0 ? (
        <div className="apple-utility-card p-12 text-center flex flex-col items-center">
          <div className="w-14 h-14 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--color-ink)] mb-1">Queue is clear</h3>
          <p className="text-xs text-[var(--color-ink-muted)] max-w-sm">
            There are no pending stories awaiting review. Excellent!
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {posts.map((post) => (
            <div key={post.id} className="apple-utility-card p-5 flex flex-col md:flex-row gap-5 items-start md:items-center justify-between border border-[var(--color-divider-soft)]">
              <div className="flex-1 min-w-0 space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="text-base font-bold text-[var(--color-ink)] leading-tight">
                    {post.title}
                  </h4>
                  <span className="text-[10px] text-[var(--color-ink-muted)] bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] px-2 py-0.5 rounded font-semibold uppercase">
                    Pending
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-[var(--color-ink-muted)]">
                  <span>Author: <strong>@{post.author.username}</strong></span>
                  <span>•</span>
                  <span>Submitted: {new Date(post.createdAt).toLocaleString()}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                <a
                  href={`/blog/${post.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="h-9 px-3.5 rounded-lg border border-[var(--color-divider-strong)] text-[var(--color-ink)] text-xs font-semibold inline-flex items-center gap-1 hover:bg-[var(--color-bg-secondary)] transition-colors"
                >
                  <Eye className="w-3.5 h-3.5" />
                  Preview
                </a>

                <button
                  onClick={() => handleApprove(post.id)}
                  disabled={actionPostId === post.id}
                  className="h-9 px-3.5 rounded-lg bg-[var(--color-action-blue)] text-white hover:bg-[var(--color-action-blue-focus)] text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  {actionPostId === post.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                  Approve
                </button>

                <button
                  onClick={() => setRejectingPostId(post.id)}
                  disabled={actionPostId === post.id}
                  className="h-9 px-3.5 rounded-lg border border-red-500/20 text-red-500 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reject
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reject Modal */}
      {rejectingPostId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl">
            <h3 className="text-lg font-bold text-[var(--color-ink)] flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Provide Rejection Reason
            </h3>
            <p className="text-xs text-[var(--color-ink-muted)]">
              Explain why this story is rejected. This feedback will be shown to the user on their Profile.
            </p>
            
            <form onSubmit={handleRejectSubmit} className="space-y-4">
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Reason (e.g. Off-topic, spam, duplicate content...)"
                rows={4}
                className="w-full p-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-red-500 outline-none resize-none"
                required
              />
              
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setRejectingPostId(null);
                    setRejectReason("");
                  }}
                  className="h-9 px-4 rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-tertiary)] text-[var(--color-ink)] text-xs font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionPostId === rejectingPostId}
                  className="h-9 px-4 rounded-lg bg-red-500 text-white hover:bg-red-600 text-xs font-semibold inline-flex items-center gap-1 disabled:opacity-50"
                >
                  {actionPostId === rejectingPostId && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Reject Post
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
