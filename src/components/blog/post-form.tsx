"use client";

import { useState, useTransition } from "react";
import { BlogEditor } from "./editor";
import { actionCreatePost, actionUpdatePost } from "@/app/actions/blog";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, FileText, Settings, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";

interface ProjectOption {
  id: string;
  name: string;
  fullName: string;
}

interface PostFormProps {
  locale: string;
  initialPost?: {
    id: string;
    title: string;
    content: string;
    summary: string | null;
    coverImage: string | null;
    projectId: string | null;
    tags: string[];
    seoTitle: string | null;
    seoDescription: string | null;
  };
  projects: ProjectOption[];
}

export function PostForm({ locale, initialPost, projects }: PostFormProps) {
  const t = useTranslations("Blog");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [title, setTitle] = useState(initialPost?.title || "");
  const [content, setContent] = useState(initialPost?.content || "");
  const [summary, setSummary] = useState(initialPost?.summary || "");
  const [coverImage, setCoverImage] = useState(initialPost?.coverImage || "");
  const [projectId, setProjectId] = useState(initialPost?.projectId || "");
  const [tagsInput, setTagsInput] = useState(initialPost?.tags.join(", ") || "");
  const [seoTitle, setSeoTitle] = useState(initialPost?.seoTitle || "");
  const [seoDescription, setSeoDescription] = useState(initialPost?.seoDescription || "");
  const [showSeo, setShowSeo] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error(t("errorTitle"));
      return;
    }
    if (!content.trim() || content === "<p></p>") {
      toast.error(t("errorContent"));
      return;
    }

    const tags = tagsInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const postData = {
      title,
      content,
      summary: summary || undefined,
      coverImage: coverImage || undefined,
      projectId: projectId || undefined,
      tags,
      seoTitle: seoTitle || undefined,
      seoDescription: seoDescription || undefined,
    };

    startTransition(async () => {
      let res;
      if (initialPost) {
        res = await actionUpdatePost(initialPost.id, postData);
      } else {
        res = await actionCreatePost(postData);
      }

      if (res.success) {
        toast.success(initialPost ? t("toastUpdated") : t("toastCreated"));
        router.push(`/${locale}/profile`);
        router.refresh();
      } else {
        toast.error(res.error || t("toastError"));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 animate-fade-in-up">
      {/* Top Bar Actions */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[var(--color-divider-soft)] pb-5 gap-4">
        <Link
          href={`/${locale}/profile`}
          className="inline-flex items-center gap-2 text-xs font-semibold text-[var(--color-ink-muted)] hover:text-[var(--color-primary)] transition-colors group cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />
          {t("backToProfile")}
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="h-10 px-5 rounded-lg bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary)]/90 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-sm disabled:opacity-50"
        >
          {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {initialPost ? t("saveChanges") : t("saveDraft")}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Editor Area (Left 8 cols) */}
        <div className="lg:col-span-8 space-y-6">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t("createTitle")}
            className="w-full text-3xl sm:text-4xl font-bold font-serif bg-transparent border-0 border-b border-transparent focus:border-[var(--color-divider-strong)] outline-none py-2 text-[var(--color-ink)] placeholder-[var(--color-ink-muted)]"
          />

          <BlogEditor content={content} onChange={setContent} />
        </div>

        {/* Configurations Area (Right 4 cols) */}
        <div className="lg:col-span-4 space-y-6 self-start lg:sticky lg:top-24">
          <div className="border border-[var(--color-divider-soft)] rounded-xl p-5 bg-[var(--color-bg-secondary)]/10 space-y-5">
            <h3 className="font-semibold text-sm flex items-center gap-2 text-[var(--color-ink)] pb-3 border-b border-[var(--color-divider-soft)]">
              <FileText className="w-4 h-4 text-[var(--color-primary)]" />
              {t("formSettings")}
            </h3>

            {/* Linked Project */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-muted)]">
                {t("formLinkProject")}
              </label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                className="w-full h-9 px-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none"
              >
                <option value="">{t("formNone")}</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.fullName})
                  </option>
                ))}
              </select>
            </div>

            {/* Cover Image URL */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-muted)]">
                {t("formCoverImage")}
              </label>
              <input
                type="url"
                value={coverImage}
                onChange={(e) => setCoverImage(e.target.value)}
                placeholder={t("formCoverPlaceholder")}
                className="w-full h-9 px-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>

            {/* Tags */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-muted)]">
                {t("formTags")}
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder={t("formTagsPlaceholder")}
                className="w-full h-9 px-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none"
              />
            </div>

            {/* Summary */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-[var(--color-ink-muted)]">
                {t("formSummary")}
              </label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                placeholder={t("formSummaryPlaceholder")}
                rows={3}
                className="w-full p-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none resize-none"
              />
            </div>
          </div>

          {/* SEO Details Toggle Box */}
          <div className="border border-[var(--color-divider-soft)] rounded-xl p-5 bg-[var(--color-bg-secondary)]/10 space-y-4">
            <button
              type="button"
              onClick={() => setShowSeo(!showSeo)}
              className="w-full flex items-center justify-between font-semibold text-sm text-[var(--color-ink)] text-left"
            >
              <span className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-emerald-500" />
                {t("formSeoTitle")}
              </span>
              <span className="text-xs text-[var(--color-ink-muted)]">
                {showSeo ? t("formSeoHide") : t("formSeoShow")}
              </span>
            </button>

            {showSeo && (
              <div className="space-y-4 pt-2 border-t border-[var(--color-divider-soft)]">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-muted)]">
                    {t("formSeoMetaTitle")}
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => setSeoTitle(e.target.value)}
                    placeholder={t("formSeoMetaTitlePlaceholder")}
                    className="w-full h-9 px-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-[var(--color-ink-muted)]">
                    {t("formSeoMetaDesc")}
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => setSeoDescription(e.target.value)}
                    placeholder={t("formSeoMetaDescPlaceholder")}
                    rows={3}
                    className="w-full p-3 rounded-lg border border-[var(--color-divider-strong)] bg-[var(--color-canvas)] text-xs text-[var(--color-ink)] focus:border-[var(--color-primary)] outline-none resize-none"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </form>
  );
}
