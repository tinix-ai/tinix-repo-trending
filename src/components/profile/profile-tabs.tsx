"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { User, FolderGit2, MessageSquare, Heart, Clock, CheckCircle2, XCircle, ExternalLink, Eye, BookOpen } from "lucide-react";
import Link from "next/link";
import { DeleteSubmissionButton } from "@/components/profile/delete-submission-button";
import { ProfileSettings } from "@/components/profile/profile-settings";
import { UserReviews } from "@/components/profile/user-reviews";
import { UserVotes } from "@/components/profile/user-votes";
import { UserPosts } from "@/components/profile/user-posts";

type Tab = "profile" | "submissions" | "stories" | "reviews" | "votes";

export function ProfileTabs({ 
  user, 
  projects, 
  reviews, 
  votes, 
  posts = [],
  locale 
}: { 
  user: any, 
  projects: any[], 
  reviews: any[], 
  votes: any[],
  posts?: any[],
  locale: string 
}) {
  const t = useTranslations("Profile");
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const tabs: { id: Tab, label: string, icon: any, count?: number }[] = [
    { id: "profile", label: t("tabs.profile"), icon: User },
    { id: "submissions", label: t("tabs.submissions"), icon: FolderGit2, count: projects.length },
    { id: "stories", label: t("tabs.stories") || "My Stories", icon: BookOpen, count: posts.length },
    { id: "reviews", label: t("tabs.reviews"), icon: MessageSquare, count: reviews.length },
    { id: "votes", label: t("tabs.votes"), icon: Heart, count: votes.length },
  ];

  const renderSubmissions = () => {
    if (projects.length === 0) {
      return (
        <div className="glass-card p-12 text-center flex flex-col items-center animate-fade-in-up">
          <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center mb-4">
            <FolderGit2 className="w-8 h-8 text-[var(--color-ink-muted-48)]" />
          </div>
          <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">{t("noProjects")}</h3>
          <p className="text-[var(--color-ink-muted-64)] mb-6 max-w-sm">
            {t("noProjectsDesc")}
          </p>
          <Link
            href={`/${locale}/submit`}
            className="px-6 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-action-blue)] text-white text-sm font-medium transition-colors hover:bg-[var(--color-action-blue-focus)]"
          >
            {t("submitProject")}
          </Link>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 animate-fade-in-up">
        {projects.map((p) => {
          const data = p.preAnalysisData as any;
          return (
            <div key={p.id} className="glass-card p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
              <div className="shrink-0">
                {data?.avatar ? (
                  <img src={data.avatar} alt="" className="w-14 h-14 rounded-xl object-cover bg-white p-1 border border-[var(--color-hairline)]" />
                ) : (
                  <div className="w-14 h-14 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink-muted-48)]">
                    <FolderGit2 className="w-6 h-6" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3 mb-1">
                  <h4 className="text-lg font-bold text-[var(--color-ink)] truncate">
                    {data?.name || p.sourceId}
                  </h4>
                  <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] text-[10px] uppercase tracking-wider font-semibold text-[var(--color-ink-muted-64)]">
                    {p.source}
                  </span>
                </div>
                <p className="text-sm text-[var(--color-ink-muted-80)] truncate mb-3">
                  {data?.description || t("noDescription")}
                </p>
                <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                  <div className="flex items-center gap-1.5">
                    {p.status === 'approved' ? (
                      <><CheckCircle2 className="w-4 h-4 text-[var(--color-status-success)]" /><span className="text-[var(--color-status-success)]">{t("statusApproved")}</span></>
                    ) : p.status === 'rejected' ? (
                      <><XCircle className="w-4 h-4 text-[var(--color-status-error)]" /><span className="text-[var(--color-status-error)]">{t("statusRejected")}</span></>
                    ) : (
                      <><Clock className="w-4 h-4 text-[var(--color-status-warning)]" /><span className="text-[var(--color-status-warning)]">{t("statusPending")}</span></>
                    )}
                  </div>
                  <div className="w-1 h-1 rounded-full bg-[var(--color-hairline)]" />
                  <span className="text-[var(--color-ink-muted-64)]">
                    {t("submittedAt", { date: new Date(p.submittedAt).toLocaleDateString() })}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[var(--color-hairline)] pt-4 sm:pt-0">
                <div className="flex items-center gap-4">
                  {p.status === 'approved' && (
                    <>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]" title="Views">
                        <Eye className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
                        <span>{p.views?.toLocaleString() || 0}</span>
                      </div>
                      <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]" title="Likes">
                        <Heart className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
                        <span>{p.likes?.toLocaleString() || 0}</span>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  {p.projectSlug && p.projectId ? (
                    <Link
                      href={`/${locale}/project/${p.projectSlug.replace(/\//g, "-")}-${p.projectId}`}
                      className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors"
                      title="View Project Detail"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </Link>
                  ) : p.url && !p.url.startsWith('custom://') ? (
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors"
                      title="Visit Source"
                    >
                      <ExternalLink className="w-5 h-5" />
                    </a>
                  ) : null}
                  <DeleteSubmissionButton id={p.id} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-8 mt-8">
      <div className="w-full md:w-64 shrink-0">
        <nav className="flex md:flex-col gap-2 overflow-x-auto pb-4 md:pb-0 hide-scrollbar">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center justify-between px-4 py-3 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? "bg-[var(--color-ink)] text-[var(--color-bg-primary)]"
                    : "text-[var(--color-ink-muted-64)] hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-ink)]"
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className="w-5 h-5" />
                  <span>{tab.label}</span>
                </div>
                {tab.count !== undefined && (
                  <span className={`px-2 py-0.5 rounded-full text-xs ${isActive ? "bg-white/20" : "bg-[var(--color-bg-tertiary)]"}`}>
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      <div className="flex-1 min-w-0">
        {activeTab === "profile" && <ProfileSettings username={user.username} role={user.role} createdAt={user.createdAt} />}
        {activeTab === "submissions" && renderSubmissions()}
        {activeTab === "stories" && <UserPosts posts={posts} locale={locale} />}
        {activeTab === "reviews" && <UserReviews reviews={reviews} locale={locale} />}
        {activeTab === "votes" && <UserVotes votes={votes} locale={locale} />}
      </div>
    </div>
  );
}
