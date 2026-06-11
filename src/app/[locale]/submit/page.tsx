"use client";

import { useTranslations } from "next-intl";
import { useActionState } from "react";
import { submitProject } from "@/app/actions";
import { Send, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";

const initialState = {
  success: false,
  error: "",
  message: ""
};

export default function SubmitPage() {
  const t = useTranslations("Submit");
  const [state, formAction, isPending] = useActionState(submitProject, initialState);

  return (
    <main className="min-h-screen bg-[var(--color-canvas)]">
      {/* Edge-to-edge Hero Tile */}
      <section className="apple-tile-light py-24 sm:py-32 border-b border-[var(--color-divider-soft)] relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-action-blue)]/5 to-transparent pointer-events-none" />
        
        <div className="page-container relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--color-surface-elevated)] shadow-sm border border-[var(--color-divider-soft)] mb-6">
            <Send className="h-6 w-6 text-[var(--color-action-blue)]" />
          </div>
          
          <h1 className="text-apple-hero text-[var(--color-ink)] mb-4 max-w-2xl">
            {t("title")}
          </h1>
          <p className="text-apple-body text-[var(--color-ink-muted-80)] max-w-xl text-lg">
            {t("subtitle")}
          </p>
        </div>
      </section>

      {/* Form Section */}
      <section className="py-16">
        <div className="page-container max-w-2xl">
          <div className="bg-[var(--color-surface-elevated)] border border-[var(--color-divider-soft)] rounded-3xl p-6 sm:p-10 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <form action={formAction} className="flex flex-col gap-6">
              
              <div className="flex flex-col gap-2">
                <label htmlFor="url" className="text-sm font-medium text-[var(--color-ink-muted-80)] ml-1">
                  URL
                </label>
                <input
                  type="url"
                  id="url"
                  name="url"
                  placeholder={t("inputPlaceholder")}
                  required
                  autoComplete="off"
                  disabled={isPending}
                  className="w-full h-14 rounded-2xl border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-5 text-base text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none transition-all duration-200 focus:border-[var(--color-action-blue)] focus:ring-4 focus:ring-[var(--color-action-blue)]/10 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              {/* Status Messages */}
              {state.success && (
                <div className="flex items-start gap-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 p-4 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{t("success")}</p>
                </div>
              )}

              {state.error && (
                <div className="flex items-start gap-3 rounded-2xl bg-red-500/10 border border-red-500/20 p-4 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                  <p className="text-sm font-medium">{t("errorUrl")}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={isPending}
                className="group relative flex h-14 w-full items-center justify-center gap-2 overflow-hidden rounded-2xl bg-[var(--color-action-blue)] text-white font-medium transition-all duration-300 hover:bg-blue-600 active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-2"
              >
                {isPending ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span>{t("submitting")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("button")}</span>
                    <Send className="h-4 w-4 transition-transform group-hover:translate-x-1 group-hover:-translate-y-1" />
                  </>
                )}
              </button>
            </form>
          </div>
          
          <div className="mt-8 text-center text-sm text-[var(--color-ink-muted-48)]">
            <p>We actively monitor spam. Duplicate or invalid links will be ignored.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
