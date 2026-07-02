"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { MessageSquare, ExternalLink, Star } from "lucide-react";

export function UserReviews({ reviews, locale }: { reviews: any[], locale: string }) {
  const t = useTranslations("Profile");

  if (!reviews || reviews.length === 0) {
    return (
      <div className="glass-card p-12 text-center flex flex-col items-center animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center mb-4">
          <MessageSquare className="w-8 h-8 text-[var(--color-ink-muted-48)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">{t("noReviews")}</h3>
        <p className="text-[var(--color-ink-muted-64)] max-w-sm">
          {t("noReviewsDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in-up">
      {reviews.map((review) => (
        <div key={review.id} className="glass-card p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              <Link 
                href={`/${locale}/project/${review.projectSlug.replace(/\//g, "-")}-${review.projectId}`}
                className="text-lg font-bold text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate"
              >
                {review.projectName}
              </Link>
              <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] text-[10px] uppercase tracking-wider font-semibold text-[var(--color-ink-muted-64)]">
                {review.projectSource}
              </span>
            </div>
            
            <div className="flex items-center gap-1 mb-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star 
                  key={star} 
                  className={`w-4 h-4 ${star <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'}`} 
                />
              ))}
            </div>

            {review.reviewText && (
              <p className="text-sm text-[var(--color-ink-muted-80)] mb-3 bg-[var(--color-bg-secondary)] p-3 rounded-lg border border-[var(--color-hairline)]">
                "{review.reviewText}"
              </p>
            )}
            
            <div className="flex items-center gap-4 text-xs font-medium text-[var(--color-ink-muted-64)]">
              <span>{new Date(review.createdAt).toLocaleDateString()}</span>
              <div className="w-1 h-1 rounded-full bg-[var(--color-hairline)]" />
              <span className={review.status === 'published' ? 'text-[var(--color-status-success)]' : 'text-[var(--color-status-warning)]'}>
                {review.status}
              </span>
            </div>
          </div>
          
          <div className="flex-shrink-0">
            <Link
              href={`/${locale}/project/${review.projectSlug.replace(/\//g, "-")}-${review.projectId}`}
              className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors inline-flex"
              title="View Project"
            >
              <ExternalLink className="w-5 h-5" />
            </Link>
          </div>
        </div>
      ))}
    </div>
  );
}
