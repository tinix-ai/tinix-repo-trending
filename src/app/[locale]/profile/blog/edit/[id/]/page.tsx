import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { getPostById } from "@/lib/db/blog-queries";
import { redirect, notFound } from "next/navigation";
import { PostForm } from "@/components/blog/post-form";
import { asc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

export default async function EditPostPage(props: {
  params: Promise<{ locale: string; id: string }>;
}) {
  const { locale, id } = await props.params;
  const session = await getSession();

  if (!session || !session.userId) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Blog");

  // Fetch the blog post
  const post = await getPostById(id);
  if (!post) {
    notFound();
  }

  // Verify ownership or check if admin
  if (post.authorId !== session.userId && session.user?.role !== "admin") {
    redirect(`/${locale}/profile`);
  }

  // Fetch all projects for the dropdown
  const projectsList = await db
    .select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
    })
    .from(projects)
    .orderBy(asc(projects.name));

  const statusLabel = post.status === "published" ? t("statusPublished")
    : post.status === "pending" ? t("statusPending")
    : post.status === "rejected" ? t("statusRejected")
    : t("statusDraft");

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{t("saveChanges")}</h1>
            <p className="text-xs text-[var(--color-ink-muted)]">
              {t("createSubtitle")}
            </p>
          </div>
          <span className="text-xs font-semibold px-2 py-0.5 rounded border border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)] uppercase">
            {statusLabel}
          </span>
        </div>

        <PostForm
          locale={locale}
          projects={projectsList}
          initialPost={{
            id: post.id,
            title: post.title,
            content: post.content,
            summary: post.summary,
            coverImage: post.coverImage,
            projectId: post.projectId,
            tags: post.tags || [],
            seoTitle: post.seoTitle,
            seoDescription: post.seoDescription,
          }}
        />
      </div>
    </div>
  );
}
