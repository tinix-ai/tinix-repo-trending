import { useTranslations } from "next-intl";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "About" });
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function AboutPage() {
  const t = useTranslations("About");

  return (
    <div className="page-container py-12">
      <div className="max-w-3xl mx-auto prose prose-invert prose-blue">
        <PageHeader 
          title={t("header")} 
        />
        
        <div className="apple-utility-card p-8 mb-8 text-[var(--color-ink)]">
          <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)] mb-6">
            {t("intro1")}
          </p>
          <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)]">
            {t("intro2")}
          </p>
        </div>

        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4 mt-12">{t("howItWorks")}</h2>
        <ul className="space-y-4 text-[var(--color-ink-muted-80)] list-disc pl-5">
          <li><strong>{t("step1Title")}:</strong> {t("step1Desc")}</li>
          <li><strong>{t("step2Title")}:</strong> {t("step2Desc")}</li>
          <li><strong>{t("step3Title")}:</strong>
            <ul className="list-circle pl-5 mt-2 space-y-2">
              <li>{t("step3Desc1")}: <code className="text-sm bg-[var(--color-divider-soft)] px-1.5 py-0.5 rounded text-[var(--color-ink)]">Stars Gained + (Forks Gained * 2) + (Contributors Gained * 5)</code></li>
              <li>{t("step3Desc2")}: <code className="text-sm bg-[var(--color-divider-soft)] px-1.5 py-0.5 rounded text-[var(--color-ink)]">Likes Gained + (Downloads Gained / 1000)</code></li>
            </ul>
          </li>
          <li><strong>{t("step4Title")}:</strong> {t("step4Desc")}</li>
        </ul>

        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4 mt-12">{t("openSource")}</h2>
        <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)]">
          {t("openSourceDesc")}
        </p>
      </div>
    </div>
  );
}
