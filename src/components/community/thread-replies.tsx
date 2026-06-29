"use client";

import React, { useState, useEffect } from "react";
import { 
  User, 
  Star, 
  MessageSquare, 
  Clock, 
  Flame, 
  MessageCircle, 
  ExternalLink,
  ShieldAlert,
  Send
} from "lucide-react";
import { formatNumber, timeAgo } from "@/lib/utils";
import { Link } from "@/i18n/routing";

interface ThreadRepliesProps {
  projectId: string;
  initialSocialMentions: any[];
  initialReviews: any[];
  locale: string;
}

export function ThreadReplies({
  projectId,
  initialSocialMentions,
  initialReviews,
  locale
}: ThreadRepliesProps) {
  const [reviews, setReviews] = useState<any[]>(initialReviews);
  const [session, setSession] = useState<any>(null);
  
  // Comment Form States
  const [ratingInput, setRatingInput] = useState(5);
  const [hoverRating, setHoverRating] = useState<number | null>(null);
  const [reviewInput, setReviewInput] = useState("");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((res) => res.json())
      .then((data) => setSession(data))
      .catch(() => setSession({ authenticated: false }));
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`/api/projects/${projectId}/reviews`);
      if (res.ok) {
        const data = await res.json();
        setReviews(data || []);
      }
    } catch (err) {
      console.error("Error fetching reviews", err);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewInput.trim()) return;
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
        throw new Error(data.error || "Failed to submit comment");
      }

      setReviewInput("");
      setRatingInput(5);
      fetchReviews();
    } catch (err: any) {
      setReviewError(err.message);
    } finally {
      setSubmitLoading(false);
    }
  };

  // Merge & Sort Reviews + Social Mentions chronologically (Oldest first for forum thread reading)
  const [unifiedFeed, setUnifiedFeed] = useState<any[]>([]);

  useEffect(() => {
    const formattedReviews = reviews.map(r => ({
      id: r.id || r.reviewId,
      type: 'user_review',
      source: 'user',
      author: r.user?.username || 'Member',
      authorAvatarUrl: null,
      content: r.reviewText,
      createdAt: new Date(r.createdAt),
      rating: r.rating,
      score: 0,
      commentsCount: 0,
      url: null
    }));

    const formattedMentions = initialSocialMentions.map(m => ({
      id: m.id,
      type: 'social_mention',
      source: m.source,
      author: m.author.split('/').pop() || m.author,
      authorAvatarUrl: m.authorAvatarUrl,
      content: m.content,
      createdAt: new Date(m.mentionedAt),
      rating: null,
      score: m.score || 0,
      commentsCount: m.commentsCount || 0,
      url: m.url
    }));

    const merged = [...formattedReviews, ...formattedMentions].sort(
      (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
    );

    setUnifiedFeed(merged);
  }, [reviews, initialSocialMentions]);

  const getSourceIcon = (source: string) => {
    switch (source) {
      case 'user':
        return <span className="text-[9px] bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full font-bold uppercase select-none">Member</span>;
      case 'reddit':
        return <span className="text-[9px] bg-orange-500/10 text-orange-600 px-2 py-0.5 rounded-full font-bold uppercase select-none">Reddit</span>;
      case 'x':
        return <span className="text-[9px] bg-[var(--color-ink)]/5 text-[var(--color-ink)] px-2 py-0.5 rounded-full font-bold uppercase select-none">X</span>;
      case 'hacker_news':
        return <span className="text-[9px] bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded-full font-bold uppercase select-none">HN</span>;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-8">
      {/* Replies Feed */}
      <div className="space-y-6">
        <h3 className="text-lg font-bold text-[var(--color-ink)] border-b border-[var(--color-divider-soft)] pb-3">
          {locale === 'vi' ? 'Ý kiến thảo luận' : 'Discussion Feed'} ({unifiedFeed.length})
        </h3>

        {unifiedFeed.length > 0 ? (
          <div className="space-y-4">
            {unifiedFeed.map((post) => (
              <div 
                key={post.id}
                className={`p-5 rounded-2xl border transition-all ${
                  post.type === 'user_review' 
                    ? 'bg-[var(--color-canvas)]/30 border-[var(--color-divider-soft)]' 
                    : 'bg-[var(--color-bg-secondary)] border-[var(--color-divider-soft)]'
                }`}
              >
                {/* Author row */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)] flex items-center justify-center text-[var(--color-ink-muted-80)] overflow-hidden">
                      {post.authorAvatarUrl ? (
                        <img src={post.authorAvatarUrl} alt={post.author} className="w-full h-full object-cover" />
                      ) : (
                        <User size={14} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[var(--color-ink)]">
                          {post.type === 'user_review' ? `@${post.author}` : post.author}
                        </span>
                        {getSourceIcon(post.source)}
                      </div>
                      <span className="text-[10px] text-[var(--color-ink-muted-48)] font-medium">
                        {timeAgo(post.createdAt)}
                      </span>
                    </div>
                  </div>

                  {/* Rating / Scores */}
                  <div>
                    {post.type === 'user_review' && post.rating && (
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            size={11}
                            className={
                              star <= post.rating
                                ? "text-yellow-400 fill-yellow-400"
                                : "text-[var(--color-border)]"
                            }
                          />
                        ))}
                      </div>
                    )}
                    {post.type === 'social_mention' && (
                      <div className="flex items-center gap-3 text-[11px] text-[var(--color-ink-muted-64)] font-medium">
                        {post.score > 0 && (
                          <span className="flex items-center gap-1">
                            <Flame className="w-3.5 h-3.5 text-orange-500" />
                            {formatNumber(post.score)}
                          </span>
                        )}
                        {post.commentsCount > 0 && (
                          <span className="flex items-center gap-1">
                            <MessageCircle className="w-3.5 h-3.5 text-[var(--color-action-blue)]" />
                            {formatNumber(post.commentsCount)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Content text */}
                <div className="mt-3 text-sm text-[var(--color-ink)] leading-relaxed whitespace-pre-wrap break-words">
                  {post.content}
                </div>

                {/* Link to original post */}
                {post.url && (
                  <div className="mt-3 flex justify-end border-t border-[var(--color-hairline)] pt-2">
                    <a
                      href={post.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-[var(--color-action-blue)] hover:underline text-xs font-semibold"
                    >
                      <span>{locale === 'vi' ? 'Xem bài gốc' : 'Original Post'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-[var(--color-bg-secondary)] border border-dashed border-[var(--color-border)] rounded-2xl p-6">
            <MessageSquare className="w-8 h-8 mx-auto text-[var(--color-ink-muted-48)] mb-3" />
            <p className="text-xs text-[var(--color-ink-muted-80)]">
              {locale === 'vi' ? 'Chưa có thảo luận nào cho dự án này.' : 'No discussions for this project yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Reply Form */}
      <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-5 shadow-sm">
        <h4 className="text-sm font-bold text-[var(--color-ink)] mb-4">
          {locale === 'vi' ? 'Gửi ý kiến của bạn' : 'Leave your response'}
        </h4>

        {session?.authenticated ? (
          <form onSubmit={handleSubmitReview} className="space-y-4">
            {/* Rating Stars Selection */}
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--color-ink-muted-80)] font-medium">
                {locale === 'vi' ? 'Đánh giá điểm số:' : 'Your Rating:'}
              </span>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setRatingInput(star)}
                    onMouseEnter={() => setHoverRating(star)}
                    onMouseLeave={() => setHoverRating(null)}
                    className="p-0.5 focus:outline-none cursor-pointer transition-colors"
                  >
                    <Star
                      size={20}
                      className={
                        star <= (hoverRating ?? ratingInput)
                          ? "text-yellow-400 fill-yellow-400"
                          : "text-[var(--color-border)] hover:text-yellow-300"
                      }
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Comment Area */}
            <div className="relative">
              <textarea
                value={reviewInput}
                onChange={(e) => setReviewInput(e.target.value)}
                placeholder={locale === 'vi' ? 'Nhập nhận xét hoặc đặt câu hỏi về dự án...' : 'Add your comment or question about this project...'}
                rows={4}
                className="w-full p-4 text-sm bg-[var(--color-canvas)] text-[var(--color-ink)] border border-[var(--color-border)] rounded-xl focus:outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]/20 transition-all placeholder:text-[var(--color-ink-muted-48)] resize-none"
              />
            </div>

            {reviewError && (
              <div className="flex items-center gap-2 text-xs text-[var(--color-error)] font-medium">
                <ShieldAlert className="w-4 h-4" />
                <span>{reviewError}</span>
              </div>
            )}

            {/* Submit Button */}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitLoading || !reviewInput.trim()}
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-[var(--color-action-blue)] text-white text-xs font-bold hover:bg-[var(--color-action-blue)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{submitLoading ? (locale === 'vi' ? 'Đang gửi...' : 'Submitting...') : (locale === 'vi' ? 'Bình luận' : 'Reply')}</span>
              </button>
            </div>
          </form>
        ) : (
          <div className="text-center py-6">
            <p className="text-xs text-[var(--color-ink-muted-80)] mb-3">
              {locale === 'vi' ? 'Vui lòng đăng nhập để tham gia thảo luận dự án.' : 'Please sign in to join the project discussion.'}
            </p>
            <Link 
              href="/login" 
              className="inline-flex h-9 items-center justify-center rounded-xl bg-[var(--color-action-blue)] px-5 text-xs font-bold text-white hover:bg-[var(--color-action-blue)]/90 transition-all"
            >
              {locale === 'vi' ? 'Đăng nhập ngay' : 'Log In Now'}
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
