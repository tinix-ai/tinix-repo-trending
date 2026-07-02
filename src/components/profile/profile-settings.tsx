"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { actionChangePassword } from "@/app/actions";
import { Lock, AlertCircle, CheckCircle2 } from "lucide-react";

export function ProfileSettings({ username, role, createdAt }: { username: string, role: string, createdAt: string }) {
  const t = useTranslations("Profile.form");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      const res = await actionChangePassword(currentPassword, newPassword);
      if (res.success) {
        setSuccess(t("success"));
        setCurrentPassword("");
        setNewPassword("");
      } else {
        setError(res.error || t("error"));
      }
    } catch (err) {
      setError(t("error"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-fade-in-up">
      <div className="glass-card p-6">
        <h3 className="text-lg font-bold text-[var(--color-ink)] mb-4">Account Information</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <span className="block text-sm font-medium text-[var(--color-ink-muted-64)] mb-1">Username</span>
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] cursor-not-allowed">
              {username}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-[var(--color-ink-muted-64)] mb-1">Role</span>
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] cursor-not-allowed capitalize">
              {role}
            </div>
          </div>
          <div>
            <span className="block text-sm font-medium text-[var(--color-ink-muted-64)] mb-1">Joined</span>
            <div className="px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] rounded-lg text-[var(--color-ink)] cursor-not-allowed">
              {new Date(createdAt).toLocaleDateString()}
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-6 border-b border-[var(--color-hairline)] pb-4">
          <div className="w-10 h-10 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink-muted-64)]">
            <Lock className="w-5 h-5" />
          </div>
          <h3 className="text-lg font-bold text-[var(--color-ink)]">{t("changePassword")}</h3>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-[var(--color-status-error)] shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-[var(--color-status-error)]">{error}</p>
          </div>
        )}

        {success && (
          <div className="mb-6 p-4 rounded-lg bg-[var(--color-status-success)]/10 border border-[var(--color-status-success)]/20 flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-[var(--color-status-success)] shrink-0 mt-0.5" />
            <p className="text-sm font-medium text-[var(--color-status-success)]">{success}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5 max-w-md">
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
              {t("currentPassword")}
            </label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-primary)] text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)]/50 focus:border-[var(--color-action-blue)] transition-all"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-[var(--color-ink)] mb-2">
              {t("newPassword")}
            </label>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-2.5 rounded-lg border border-[var(--color-hairline)] bg-[var(--color-bg-primary)] text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)] focus:outline-none focus:ring-2 focus:ring-[var(--color-action-blue)]/50 focus:border-[var(--color-action-blue)] transition-all"
              required
              minLength={6}
            />
          </div>

          <button
            type="submit"
            disabled={loading || !currentPassword || !newPassword}
            className="w-full sm:w-auto px-6 py-2.5 rounded-lg bg-[var(--color-ink)] text-[var(--color-bg-primary)] text-sm font-medium transition-colors hover:bg-[var(--color-ink-muted-80)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-current border-r-transparent rounded-full animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              t("changePassword")
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
