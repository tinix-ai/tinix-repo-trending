"use client";

import { useState, useEffect } from "react";
import { CheckCircle, XCircle, Trash2, ExternalLink, Filter, MessageSquare, ShieldAlert } from "lucide-react";
import { timeAgo } from "@/lib/utils";

interface Review {
  id: string;
  rating: number;
  reviewText: string;
  status: string;
  createdAt: string;
  user: {
    username: string;
  };
  project: {
    id: string;
    name: string;
    slug: string;
  };
}

export function ReviewsManager() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"pending" | "published" | "rejected">("pending");
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchReviews = async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/reviews?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data.reviews || []);
      }
    } catch (error) {
      console.error("Failed to fetch reviews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews(filter);
  }, [filter]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setActionLoading(id);
    try {
      const res = await fetch("/api/admin/reviews", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, status: newStatus }),
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Failed to update review status:", error);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review permanently?")) return;
    
    setActionLoading(id);
    try {
      const res = await fetch(`/api/admin/reviews?id=${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (error) {
      console.error("Failed to delete review:", error);
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[var(--color-ink)]">Content Moderation</h2>
            <p className="text-sm text-[var(--color-ink-muted-80)]">Review and manage user comments</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] p-1 rounded-xl shadow-sm">
          <Filter className="w-4 h-4 text-[var(--color-ink-muted-48)] ml-2" />
          {(["pending", "published", "rejected"] as const).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold capitalize transition-all ${
                filter === status
                  ? "bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm"
                  : "text-[var(--color-ink-muted-80)] hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)]"
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="flex justify-center items-center h-48">
            <div className="w-8 h-8 border-2 border-[var(--color-action-blue)]/30 border-t-[var(--color-action-blue)] rounded-full animate-spin" />
          </div>
        ) : reviews.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center px-4">
            <ShieldAlert className="w-10 h-10 text-[var(--color-ink-muted-48)] mb-3" />
            <h3 className="text-sm font-bold text-[var(--color-ink)] mb-1">No reviews found</h3>
            <p className="text-xs text-[var(--color-ink-muted-80)]">
              There are no {filter} reviews at the moment.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[var(--color-divider-soft)]">
            {reviews.map((review) => (
              <div key={review.id} className="p-6 hover:bg-[var(--color-canvas)]/30 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                  
                  {/* Left: Content */}
                  <div className="flex-1 space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold text-[var(--color-ink)]">@{review.user.username}</span>
                      <span className="text-xs text-[var(--color-ink-muted-48)] font-medium">• {timeAgo(review.createdAt)}</span>
                      <div className="flex items-center gap-0.5 ml-2 text-[var(--color-warning)]">
                        {Array.from({ length: review.rating }).map((_, i) => (
                          <span key={i} className="text-sm">★</span>
                        ))}
                      </div>
                    </div>
                    
                    <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed whitespace-pre-wrap">
                      {review.reviewText || <span className="italic text-[var(--color-ink-muted-48)]">No text content provided</span>}
                    </p>

                    <a 
                      href={`/vi/project/${review.project.slug}-${review.project.id}?tab=community`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--color-action-blue)] hover:underline"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      View on Project: {review.project.name}
                    </a>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {filter !== "published" && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, "published")}
                        disabled={actionLoading === review.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                    )}
                    {filter !== "rejected" && (
                      <button
                        onClick={() => handleUpdateStatus(review.id, "rejected")}
                        disabled={actionLoading === review.id}
                        className="flex items-center gap-1.5 px-3 py-2 bg-orange-500/10 text-orange-600 hover:bg-orange-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(review.id)}
                      disabled={actionLoading === review.id}
                      className="flex items-center gap-1.5 px-3 py-2 bg-red-500/10 text-red-600 hover:bg-red-500/20 rounded-lg text-xs font-bold transition-colors disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" /> Delete
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
