import { Link } from "@/i18n/routing";
import { AlertCircle } from "lucide-react";
import { useTranslations } from "next-intl";

export default function NotFound() {
  const t = useTranslations("NotFound");

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center text-red-500 mb-6">
        <AlertCircle className="w-8 h-8" />
      </div>
      <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] mb-4">
        {t("title")}
      </h1>
      <p className="text-[var(--color-ink-muted-80)] max-w-md mb-8 text-lg">
        {t("desc")}
      </p>
      <Link 
        href="/"
        className="apple-btn-primary"
      >
        {t("backHome")}
      </Link>
    </div>
  );
}
