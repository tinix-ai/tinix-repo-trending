import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { projects } from "@/lib/db/schema";
import { redirect } from "next/navigation";
import { PostForm } from "@/components/blog/post-form";
import { asc } from "drizzle-orm";
import { getTranslations } from "next-intl/server";

export default async function NewPostPage(props: { params: Promise<{ locale: string }> }) {
  const { locale } = await props.params;
  const session = await getSession();

  if (!session || !session.userId) {
    redirect(`/${locale}/login`);
  }

  const t = await getTranslations("Blog");

  // Fetch all projects in the system to populate the dropdown selection
  const projectsList = await db
    .select({
      id: projects.id,
      name: projects.name,
      fullName: projects.fullName,
    })
    .from(projects)
    .orderBy(asc(projects.name));

  return (
    <div className="page-container py-8 md:py-12 min-h-screen">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--color-ink)]">{t("createTitle")}</h1>
          <p className="text-xs text-[var(--color-ink-muted)]">
            {t("createSubtitle")}
          </p>
        </div>

        <PostForm locale={locale} projects={projectsList} />
      </div>
    </div>
  );
}
