"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { Heart, ExternalLink, FolderGit2 } from "lucide-react";

export function UserVotes({ votes, locale }: { votes: any[], locale: string }) {
  const t = useTranslations("Profile");

  if (!votes || votes.length === 0) {
    return (
      <div className="glass-card p-12 text-center flex flex-col items-center animate-fade-in-up">
        <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center mb-4">
          <Heart className="w-8 h-8 text-[var(--color-ink-muted-48)]" />
        </div>
        <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">{t("noVotes")}</h3>
        <p className="text-[var(--color-ink-muted-64)] max-w-sm">
          {t("noVotesDesc")}
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in-up">
      {votes.map((vote) => {
        return (
          <div key={vote.id} className="glass-card p-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="shrink-0">
                {vote.ownerAvatarUrl ? (
                  <img src={vote.ownerAvatarUrl} alt="" className="w-10 h-10 rounded-lg object-cover bg-white p-0.5 border border-[var(--color-hairline)]" />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink-muted-48)]">
                    <FolderGit2 className="w-5 h-5" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <Link 
                  href={`/${locale}/project/${vote.projectSlug.replace(/\//g, "-")}-${vote.projectId}`}
                  className="font-bold text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate block"
                  title={vote.projectName}
                >
                  {vote.projectName}
                </Link>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-[var(--color-ink-muted-64)] truncate">
                    {vote.projectFullName}
                  </span>
                </div>
              </div>
            </div>

            <p className="text-sm text-[var(--color-ink-muted-80)] line-clamp-2 min-h-[2.5rem]">
              {vote.description || t("noDescription")}
            </p>
            
            <div className="flex items-center justify-between mt-auto pt-4 border-t border-[var(--color-hairline)]">
              <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted-64)] font-medium">
                <Heart className="w-4 h-4 text-red-500 fill-red-500" />
                <span>{new Date(vote.createdAt).toLocaleDateString()}</span>
              </div>
              <Link
                href={`/${locale}/project/${vote.projectSlug.replace(/\//g, "-")}-${vote.projectId}`}
                className="p-1.5 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors"
                title="View Project"
              >
                <ExternalLink className="w-4 h-4" />
              </Link>
            </div>
          </div>
        );
      })}
    </div>
  );
}
