import { getPublishedPosts, getTrendingPosts } from "@/lib/db/blog-queries";
import { getSession } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { PenSquare, Flame, Sparkles, Tag, Eye, Clock, ArrowUpRight } from "lucide-react";

// Helper for estimate reading time
function getReadingTime(htmlContent: string) {
  const text = htmlContent.replace(/<[^>]*>/g, ""); // strip HTML tags
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 200;
  return Math.ceil(words / wordsPerMinute);
}

export default async function BlogFeedPage(props: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ tag?: string }>;
}) {
  const { locale } = await props.params;
  const searchParams = await props.searchParams;
  const activeTag = searchParams.tag;

  const t = await getTranslations("Blog");
  const session = await getSession();

  // Fetch posts & trending list
  const postsList = await getPublishedPosts({ tag: activeTag });
  const trendingPosts = await getTrendingPosts(5);

  // Extract all unique tags from posts for filter list
  const allTagsSet = new Set<string>();
  postsList.forEach((p) => {
    if (Array.isArray(p.tags)) {
      p.tags.forEach((tag) => allTagsSet.add(tag));
    }
  });
  const uniqueTags = Array.from(allTagsSet);

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="border-b border-[var(--color-divider-soft)] pb-8 mb-10 flex flex-col md:flex-row md:items-end md:justify-between gap-6">
          <div>
            <h1 className="text-apple-hero text-[var(--color-ink)] mb-3">
              {t("feedTitle")}
            </h1>
            <p className="text-[var(--color-ink-muted)] text-base sm:text-lg max-w-2xl font-light">
              {t("feedSubtitle")}
            </p>
          </div>
          {session?.authenticated && (
            <Link
              href="/profile"
              className="inline-flex items-center gap-2 h-11 px-6 rounded-full bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 transition-all font-semibold shadow-sm hover:shadow active:scale-[0.98] cursor-pointer"
            >
              <PenSquare className="w-4 h-4" />
              {t("writeStory")}
            </Link>
          )}
        </div>

        {/* Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Main Feed */}
          <main className="lg:col-span-8 space-y-12">
            
            {/* Tag Filter Header */}
            {activeTag && (
              <div className="flex items-center gap-2 bg-[var(--color-bg-secondary)] px-4 py-2 rounded-xl border border-[var(--color-divider-soft)] text-sm">
                <Tag className="w-4 h-4 text-[var(--color-primary)]" />
                <span>{t("tagFilterLabel")} <strong className="text-[var(--color-primary)] font-semibold">#{activeTag}</strong></span>
                <Link href="/blog" className="ml-auto text-xs text-[var(--color-ink-muted)] hover:text-[var(--color-ink)] underline">
                  {t("clearFilter")}
                </Link>
              </div>
            )}

            {postsList.length === 0 ? (
              <div className="text-center py-20 border border-dashed border-[var(--color-divider-soft)] rounded-2xl bg-[var(--color-bg-secondary)]/30">
                <Sparkles className="w-12 h-12 text-[var(--color-ink-muted-48)] mx-auto mb-4" />
                <h3 className="text-lg font-bold mb-1">{t("noArticles")}</h3>
                <p className="text-[var(--color-ink-muted)] text-sm max-w-md mx-auto">
                  {activeTag ? t("noArticlesTag") : t("noArticlesEmpty")}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[var(--color-divider-soft)] space-y-12 [&>article]:pt-12 first:[&>article]:pt-0">
                {postsList.map((post) => {
                  const readingTime = getReadingTime(post.summary || "");
                  return (
                    <article key={post.id} className="group flex flex-col md:flex-row gap-6 md:gap-8 items-start">
                      
                      {/* Text Content */}
                      <div className="flex-1 space-y-3">
                        {/* Author & Date */}
                        <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)] font-medium">
                          <div className="w-5 h-5 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold font-serif text-[10px]">
                            {post.author.username[0].toUpperCase()}
                          </div>
                          <span>@{post.author.username}</span>
                          <span>•</span>
                          <span>
                            {new Date(post.publishedAt || post.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {/* Title & Link */}
                        <Link href={`/blog/${post.slug}`} className="block group-hover:text-[var(--color-primary)] transition-colors">
                          <h2 className="text-xl sm:text-2xl font-bold font-serif leading-tight">
                            {post.title}
                          </h2>
                        </Link>

                        {/* Summary */}
                        <p className="text-[var(--color-ink-muted)] text-sm sm:text-base line-clamp-3 font-light leading-relaxed">
                          {post.summary}
                        </p>

                        {/* Footer details */}
                        <div className="flex flex-wrap items-center gap-3 pt-2 text-xs text-[var(--color-ink-muted)]">
                          {/* Tags */}
                          {post.tags && Array.isArray(post.tags) && post.tags.map((tag) => (
                            <Link
                              key={tag}
                              href={`/blog?tag=${tag}`}
                              className="bg-[var(--color-bg-secondary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] px-2.5 py-1 rounded-full border border-[var(--color-divider-soft)] transition-colors"
                            >
                              #{tag}
                            </Link>
                          ))}
                          
                          <span className="flex items-center gap-1 ml-auto">
                            <Clock className="w-3.5 h-3.5" />
                            {t("minRead", { count: readingTime })}
                          </span>
                        </div>

                        {/* Linked Project Card */}
                        {post.project && (
                          <div className="mt-4 p-3 bg-[var(--color-bg-secondary)]/30 rounded-xl border border-[var(--color-divider-soft)] hover:border-[var(--color-primary)]/30 transition-all flex items-center gap-3 group/proj">
                            {post.project.ownerAvatarUrl && (
                              <img
                                src={post.project.ownerAvatarUrl}
                                alt={post.project.name}
                                className="w-8 h-8 rounded-lg object-cover bg-white"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <h4 className="text-xs font-semibold text-[var(--color-ink)] truncate group-hover/proj:text-[var(--color-primary)]">
                                {post.project.name}
                              </h4>
                              <p className="text-[10px] text-[var(--color-ink-muted)]">
                                {post.project.primaryLanguage || "Open Source"}
                              </p>
                            </div>
                            <Link
                              href={`/project/${post.project.slug}`}
                              className="text-[10px] text-[var(--color-primary)] font-semibold inline-flex items-center gap-0.5 hover:underline"
                            >
                              {t("viewProject")}
                              <ArrowUpRight className="w-3 h-3" />
                            </Link>
                          </div>
                        )}

                      </div>

                      {/* Cover Image (optional) */}
                      {post.coverImage && (
                        <div className="w-full md:w-48 h-32 shrink-0 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] group-hover:shadow-sm transition-shadow">
                          <img
                            src={post.coverImage}
                            alt={post.title}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                          />
                        </div>
                      )}

                    </article>
                  );
                })}
              </div>
            )}

          </main>

          {/* Sticky Sidebar */}
          <aside className="lg:col-span-4 space-y-10 lg:sticky lg:top-24 self-start">
            
            {/* Trending Section */}
            {trendingPosts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted-48)] flex items-center gap-1.5">
                  <Flame className="w-4 h-4 text-orange-500" />
                  {t("trendingTitle")}
                </h3>
                <div className="space-y-4">
                  {trendingPosts.map((post, idx) => (
                    <div key={post.id} className="flex gap-4 items-start">
                      <span className="text-3xl font-bold font-serif text-[var(--color-divider-strong)] w-8 text-right select-none">
                        0{idx + 1}
                      </span>
                      <div className="space-y-1">
                        <div className="text-[10px] font-semibold text-[var(--color-ink-muted)]">
                          @{post.author.username}
                        </div>
                        <Link
                          href={`/blog/${post.slug}`}
                          className="font-bold text-sm font-serif line-clamp-2 hover:text-[var(--color-primary)] transition-colors leading-tight"
                        >
                          {post.title}
                        </Link>
                        <div className="flex items-center gap-2 text-[10px] text-[var(--color-ink-muted)]">
                          <span>{new Date(post.publishedAt || '').toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", { month: "short", day: "numeric" })}</span>
                          <span>•</span>
                          <span className="flex items-center gap-0.5">
                            <Eye className="w-3 h-3" />
                            {post.views}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Popular Topics Section */}
            {uniqueTags.length > 0 && (
              <div className="border-t border-[var(--color-divider-soft)] pt-6 space-y-4">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--color-ink-muted-48)]">
                  {t("discoverTopics")}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {uniqueTags.map((tag) => (
                    <Link
                      key={tag}
                      href={`/blog?tag=${tag}`}
                      className={`text-xs px-3 py-1.5 rounded-full border border-[var(--color-divider-soft)] transition-colors ${
                        activeTag === tag
                          ? "bg-[var(--color-primary)] text-white border-[var(--color-primary)] font-semibold"
                          : "bg-[var(--color-bg-secondary)]/50 hover:bg-[var(--color-bg-secondary)] hover:text-[var(--color-primary)]"
                      }`}
                    >
                      #{tag}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Platform callout */}
            <div className="border border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)]/20 rounded-2xl p-6 space-y-4">
              <h4 className="font-serif font-bold text-base">{t("writeOnTinix")}</h4>
              <p className="text-xs text-[var(--color-ink-muted)] leading-relaxed">
                {t("writeOnTinixDesc")}
              </p>
              <Link
                href="/profile"
                className="w-full text-center py-2.5 bg-[var(--color-ink)] text-[var(--color-canvas)] text-xs font-semibold rounded-xl block hover:bg-[var(--color-ink)]/90 transition-colors"
              >
                {t("goToProfile")}
              </Link>
            </div>

          </aside>
        </div>

      </div>
    </div>
  );
}
