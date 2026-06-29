import React from "react";
import { db } from "@/lib/db";
import { projectReviews, users, projects } from "@/lib/db/schema";
import { eq, desc, sql } from "drizzle-orm";
import { Star, MessageSquare, User, ArrowUpRight } from "lucide-react";
import { Link } from "@/i18n/routing";
import { ProjectAvatar } from "@/components/common/project-avatar";
import { timeAgo } from "@/lib/utils";

const localizations: Record<string, any> = {
  vi: {
    title: "Diễn đàn TiniX",
    subtitle: "Nơi thảo luận, chấm điểm và đánh giá các dự án AI/ML hàng đầu từ cộng đồng lập trình viên.",
    feedTitle: "Hoạt động mới nhất",
    noReviews: "Chưa có hoạt động nào",
    noReviewsDesc: "Hãy là người đầu tiên tham gia đánh giá các dự án công nghệ!",
    topRatedTitle: "Dự án Đánh giá cao nhất",
    mostActiveTitle: "Thảo luận sôi nổi nhất",
    ratedText: "đã đánh giá",
    reviewsCountText: "đánh giá",
    viewProject: "Xem chi tiết",
  },
  en: {
    title: "TiniX Community Forum",
    subtitle: "Discuss, rate, and review trending open-source AI/ML projects.",
    feedTitle: "Latest Activity Feed",
    noReviews: "No recent activities",
    noReviewsDesc: "Be the first to rate and review community open-source repositories!",
    topRatedTitle: "Top Rated Projects",
    mostActiveTitle: "Most Active Discussions",
    ratedText: "rated",
    reviewsCountText: "reviews",
    viewProject: "View details",
  }
};

export default async function ForumPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = localizations[locale] || localizations.vi;

  // 1. Fetch Feed
  const feed = await db
    .select({
      reviewId: projectReviews.id,
      rating: projectReviews.rating,
      reviewText: projectReviews.reviewText,
      createdAt: projectReviews.createdAt,
      user: {
        username: users.username,
        role: users.role,
      },
      project: {
        id: projects.id,
        name: projects.name,
        fullName: projects.fullName,
        slug: projects.slug,
        source: projects.source,
        projectType: projects.projectType,
        ownerAvatarUrl: projects.ownerAvatarUrl,
        description: projects.description,
      },
    })
    .from(projectReviews)
    .innerJoin(users, eq(projectReviews.userId, users.id))
    .innerJoin(projects, eq(projectReviews.projectId, projects.id))
    .orderBy(desc(projectReviews.createdAt))
    .limit(20);

  // 2. Fetch Top Rated Projects (min 1 review)
  const topRated = await db
    .select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
      slug: projects.slug,
      ownerAvatarUrl: projects.ownerAvatarUrl,
      avgRating: sql<string>`round(avg(${projectReviews.rating}), 1)`,
      reviewsCount: sql<number>`count(${projectReviews.id})`,
    })
    .from(projects)
    .innerJoin(projectReviews, eq(projects.id, projectReviews.projectId))
    .groupBy(projects.id)
    .orderBy(desc(sql`avg(${projectReviews.rating})`), desc(sql`count(${projectReviews.id})`))
    .limit(5);

  // 3. Fetch Most Active Projects
  const mostActive = await db
    .select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
      slug: projects.slug,
      ownerAvatarUrl: projects.ownerAvatarUrl,
      reviewsCount: sql<number>`count(${projectReviews.id})`,
    })
    .from(projects)
    .innerJoin(projectReviews, eq(projects.id, projectReviews.projectId))
    .groupBy(projects.id)
    .orderBy(desc(sql`count(${projectReviews.id})`))
    .limit(5);

  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)]">
      {/* Hero Section */}
      <section className="apple-tile-light w-full py-12 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="flex flex-col gap-3 max-w-3xl">
            <h1 className="text-3xl font-extrabold text-[var(--color-ink)] tracking-tight">
              {t.title}
            </h1>
            <p className="text-[15px] text-[var(--color-ink-muted-80)] leading-relaxed">
              {t.subtitle}
            </p>
          </div>
        </div>
      </section>

      {/* Main Forum Grid */}
      <section className="apple-tile-parchment w-full py-12">
        <div className="page-container max-w-5xl">
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
            
            {/* Feed Column */}
            <div className="space-y-6">
              <h2 className="text-lg font-bold text-[var(--color-ink)] tracking-tight">
                {t.feedTitle}
              </h2>

              {feed.length > 0 ? (
                <div className="space-y-6">
                  {feed.map((item) => (
                    <div
                      key={item.reviewId}
                      className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] shadow-sm rounded-2xl p-6 space-y-4 hover:border-[var(--color-border-hover)] transition-all animate-fade-in-up"
                    >
                      {/* User Header */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--color-canvas)] border border-[var(--color-border)] text-[var(--color-ink-muted-80)]">
                            <User size={15} />
                          </div>
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-[var(--color-ink)]">
                              @{item.user.username}
                            </span>
                            <span className="text-[10px] text-[var(--color-ink-muted-48)] uppercase tracking-wider font-semibold">
                              {timeAgo(item.createdAt)}
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
                                star <= item.rating
                                  ? "fill-[var(--color-warning)] text-[var(--color-warning)]"
                                  : "text-[var(--color-ink-muted-48)]"
                              }
                            />
                          ))}
                        </div>
                      </div>

                      {/* Review Comment */}
                      {item.reviewText && (
                        <p className="text-sm text-[var(--color-ink-muted-80)] leading-relaxed italic bg-[var(--color-canvas)]/30 p-3.5 border-l-2 border-[var(--color-action-blue)]/30 rounded-r-xl">
                          "{item.reviewText}"
                        </p>
                      )}

                      {/* Linked Project Card */}
                      <div className="bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl p-4 flex items-center justify-between gap-4 group">
                        <div className="flex items-center gap-3 min-w-0">
                          <ProjectAvatar
                            src={item.project.ownerAvatarUrl}
                            name={item.project.name}
                            size={32}
                          />
                          <div className="min-w-0">
                            <h4 className="text-xs font-bold text-[var(--color-ink)] truncate">
                              {item.project.fullName}
                            </h4>
                            <p className="text-[10px] text-[var(--color-ink-muted-64)] truncate max-w-[400px]">
                              {item.project.description || "No description"}
                            </p>
                          </div>
                        </div>

                        <Link
                          href={`/project/${item.project.slug}-${item.project.id}`}
                          className="shrink-0 flex items-center gap-1 text-[11px] font-bold text-[var(--color-action-blue)] group-hover:underline"
                        >
                          {t.viewProject}
                          <ArrowUpRight size={13} className="transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] border-dashed rounded-2xl p-12 text-center flex flex-col items-center justify-center animate-fade-in-up">
                  <div className="w-16 h-16 rounded-full bg-[var(--color-canvas)] flex items-center justify-center mb-4">
                    <MessageSquare size={26} className="text-[var(--color-ink-muted-48)]" />
                  </div>
                  <h3 className="text-sm font-bold text-[var(--color-ink)] mb-2">
                    {t.noReviews}
                  </h3>
                  <p className="text-xs text-[var(--color-ink-muted-80)] max-w-sm">
                    {t.noReviewsDesc}
                  </p>
                </div>
              )}
            </div>

            {/* Sidebar Column */}
            <aside className="space-y-8">
              
              {/* Top Rated Projects */}
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">
                  {t.topRatedTitle}
                </h3>
                {topRated.length > 0 ? (
                  <div className="space-y-3.5 divide-y divide-[var(--color-divider-soft)]">
                    {topRated.map((item, idx) => (
                      <div key={item.id} className={`flex items-center justify-between gap-3 ${idx > 0 ? "pt-3.5" : ""}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProjectAvatar src={item.ownerAvatarUrl} name={item.name} size={24} />
                          <Link
                            href={`/project/${item.slug}-${item.id}`}
                            className="text-xs font-bold text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate"
                          >
                            {item.fullName.split("/")[1] || item.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 bg-[var(--color-warning)]/10 text-[var(--color-warning)] px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          <Star size={10} className="fill-[var(--color-warning)]" />
                          <span>{item.avgRating}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-ink-muted-48)]">Không có dữ liệu</p>
                )}
              </div>

              {/* Most Active Projects */}
              <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-2xl p-6 space-y-4 shadow-sm">
                <h3 className="text-xs font-bold text-[var(--color-ink)] uppercase tracking-wider">
                  {t.mostActiveTitle}
                </h3>
                {mostActive.length > 0 ? (
                  <div className="space-y-3.5 divide-y divide-[var(--color-divider-soft)]">
                    {mostActive.map((item, idx) => (
                      <div key={item.id} className={`flex items-center justify-between gap-3 ${idx > 0 ? "pt-3.5" : ""}`}>
                        <div className="flex items-center gap-2.5 min-w-0">
                          <ProjectAvatar src={item.ownerAvatarUrl} name={item.name} size={24} />
                          <Link
                            href={`/project/${item.slug}-${item.id}`}
                            className="text-xs font-bold text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate"
                          >
                            {item.fullName.split("/")[1] || item.name}
                          </Link>
                        </div>
                        <div className="flex items-center gap-1 shrink-0 bg-[var(--color-action-blue)]/5 text-[var(--color-action-blue)] border border-[var(--color-action-blue)]/10 px-2 py-0.5 rounded-full text-[10px] font-semibold">
                          <span>{item.reviewsCount} {t.reviewsCountText}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-[var(--color-ink-muted-48)]">Không có dữ liệu</p>
                )}
              </div>

            </aside>
            
          </div>
        </div>
      </section>
    </div>
  );
}
