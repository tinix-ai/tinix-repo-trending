import { getPostBySlug, incrementPostViews } from "@/lib/db/blog-queries";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Eye, Calendar, ArrowUpRight, Github, ExternalLink } from "lucide-react";
import type { Metadata } from "next";

// Helper for estimate reading time
function getReadingTime(htmlContent: string) {
  const text = htmlContent.replace(/<[^>]*>/g, ""); // strip HTML tags
  const words = text.trim().split(/\s+/).length;
  const wordsPerMinute = 200;
  return Math.ceil(words / wordsPerMinute);
}

// Next.js dynamic metadata generation for SEO
export async function generateMetadata(
  props: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await props.params;
  const post = await getPostBySlug(slug);

  if (!post || post.status !== "published") {
    return {};
  }

  const title = post.seoTitle || post.title;
  const description = post.seoDescription || post.summary || post.title.substring(0, 150);

  return {
    title: `${title} — TiniX Blog`,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      url: `https://tinix.dev/blog/${post.slug}`,
      images: post.coverImage ? [{ url: post.coverImage }] : undefined,
      publishedTime: post.publishedAt?.toISOString(),
      authors: [`@${post.author.username}`],
    },
    twitter: {
      card: post.coverImage ? "summary_large_image" : "summary",
      title,
      description,
      images: post.coverImage ? [post.coverImage] : undefined,
    },
  };
}

export default async function BlogDetailPage(props: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await props.params;
  const post = await getPostBySlug(slug);

  if (!post || post.status !== "published") {
    notFound();
  }

  const t = await getTranslations("Blog");

  // Increment views
  await incrementPostViews(post.id);

  const readingTime = getReadingTime(post.content);

  // Generate structured data for search engine rich results (JSON-LD)
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    "headline": post.title,
    "description": post.summary || post.seoDescription || post.title.substring(0, 150),
    "image": post.coverImage || "https://tinix.dev/og-image.png",
    "datePublished": post.publishedAt?.toISOString() || post.createdAt?.toISOString(),
    "dateModified": post.publishedAt?.toISOString() || post.createdAt?.toISOString(),
    "author": {
      "@type": "Person",
      "name": post.author.username,
      "url": `https://tinix.dev/user/${post.author.username}`,
    },
    "publisher": {
      "@type": "Organization",
      "name": "TiniX",
      "logo": {
        "@type": "ImageObject",
        "url": "https://tinix.dev/logo.png",
      },
    },
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": `https://tinix.dev/blog/${post.slug}`,
    },
  };

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      {/* Inject Structured Data */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <div className="max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/blog"
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] mb-8 transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t("backToList")}
        </Link>

        {/* Article Wrapper */}
        <article className="space-y-8">
          
          {/* Metadata Header */}
          <div className="space-y-4">
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
              {post.title}
            </h1>
            
            {post.summary && (
              <p className="text-lg sm:text-xl text-[var(--color-ink-muted)] font-light leading-relaxed">
                {post.summary}
              </p>
            )}

            {/* Author info & stats */}
            <div className="flex flex-wrap items-center justify-between border-y border-[var(--color-divider-soft)] py-4 gap-4 text-xs sm:text-sm text-[var(--color-ink-muted)]">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-full bg-[var(--color-primary)]/10 text-[var(--color-primary)] flex items-center justify-center font-bold font-serif text-sm">
                  {post.author.username[0].toUpperCase()}
                </div>
                <div>
                  <div className="font-semibold text-[var(--color-ink)]">
                    @{post.author.username}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>
                      {new Date(post.publishedAt || post.createdAt).toLocaleDateString(locale === "vi" ? "vi-VN" : "en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {t("minRead", { count: readingTime })}
                </span>
                <span className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {t("views", { count: post.views })}
                </span>
              </div>
            </div>
          </div>

          {/* Linked Project Cite Block */}
          {post.project && (
            <div className="my-8 p-6 bg-gradient-to-br from-[var(--color-primary)]/5 to-transparent rounded-2xl border border-[var(--color-primary)]/20 shadow-sm flex flex-col sm:flex-row gap-6 items-start sm:items-center relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:opacity-[0.05] group-hover:scale-110 transition-all duration-500">
                <Github className="w-32 h-32 -mt-4 -mr-4" />
              </div>
              
              {post.project.ownerAvatarUrl && (
                <img
                  src={post.project.ownerAvatarUrl}
                  alt={post.project.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl object-cover bg-white border border-[var(--color-divider-soft)] shrink-0 shadow-sm relative z-10"
                />
              )}
              <div className="flex-1 min-w-0 relative z-10">
                <div className="text-[10px] font-bold text-[var(--color-primary)] uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                  {t("featuredProject")}
                </div>
                <div className="flex items-center gap-3 mb-2 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-bold font-serif text-[var(--color-ink)] truncate">
                    {post.project.name}
                  </h3>
                  <div className="flex gap-2 items-center mt-0.5">
                    {post.project.primaryLanguage && (
                      <span className="text-[10px] bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted)] px-2.5 py-0.5 rounded-full border border-[var(--color-divider-soft)] font-semibold shadow-sm">
                        {post.project.primaryLanguage}
                      </span>
                    )}
                    <span className="text-[11px] text-[var(--color-ink-muted)] flex items-center gap-1 font-semibold bg-[var(--color-canvas)] px-2.5 py-0.5 rounded-full border border-[var(--color-divider-soft)] shadow-sm">
                      ★ {post.project.stars?.toLocaleString() || 0}
                    </span>
                  </div>
                </div>
                <p className="text-sm text-[var(--color-ink-muted)] line-clamp-2 leading-relaxed max-w-2xl">
                  {post.project.description || t("noDescription")}
                </p>
              </div>
              <div className="flex sm:flex-col gap-2 shrink-0 w-full sm:w-auto relative z-10 mt-2 sm:mt-0">
                <Link
                  href={`/project/${post.project.slug}`}
                  className="flex-1 sm:flex-none text-center h-11 px-6 rounded-xl bg-[var(--color-primary)] text-white text-sm font-semibold flex items-center justify-center hover:bg-[var(--color-primary)]/90 hover:scale-[1.02] active:scale-[0.98] transition-all shadow-md cursor-pointer shadow-[var(--color-primary)]/20"
                >
                  {t("viewProject")}
                  <ArrowUpRight className="w-4 h-4 ml-1.5" />
                </Link>
                {post.project.sourceUrl && (
                  <a
                    href={post.project.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="flex-1 sm:flex-none text-center h-10 px-4 rounded-xl border border-[var(--color-divider-strong)] text-[var(--color-ink)] text-xs font-semibold flex items-center justify-center hover:bg-[var(--color-bg-secondary)] transition-colors cursor-pointer"
                  >
                    {t("sourceCode")}
                    <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
                  </a>
                )}
              </div>
            </div>
          )}

          {/* Cover Image */}
          {post.coverImage && (
            <div className="w-full h-[250px] sm:h-[400px] rounded-2xl overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)]">
              <img
                src={post.coverImage}
                alt={post.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}

          {/* Tag labels */}
          {post.tags && Array.isArray(post.tags) && post.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 pt-2">
              {post.tags.map((tag) => (
                <Link
                  key={tag}
                  href={`/blog?tag=${tag}`}
                  className="bg-[var(--color-bg-secondary)] hover:bg-[var(--color-primary)]/10 hover:text-[var(--color-primary)] text-xs px-3 py-1 rounded-full border border-[var(--color-divider-soft)] transition-colors"
                >
                  #{tag}
                </Link>
              ))}
            </div>
          )}

          {/* Main Content */}
          <div 
            className="prose prose-base sm:prose-lg dark:prose-invert max-w-none text-[var(--color-ink)] font-serif leading-relaxed space-y-6 pt-4 border-b border-[var(--color-divider-soft)] pb-8 prose-headings:font-serif prose-a:text-[var(--color-primary)] prose-a:no-underline hover:prose-a:underline prose-blockquote:border-l-4 prose-blockquote:border-[var(--color-primary)] prose-blockquote:pl-6 prose-blockquote:italic"
            dangerouslySetInnerHTML={{ __html: post.content }}
          />

        </article>
      </div>
    </div>
  );
}
