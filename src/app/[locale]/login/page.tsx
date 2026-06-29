"use client";

import React, { useState, use } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LogIn, UserPlus, Key, User, ShieldAlert, ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";

interface Translations {
  titleLogin: string;
  titleRegister: string;
  subtitleLogin: string;
  subtitleRegister: string;
  usernameLabel: string;
  passwordLabel: string;
  submitLogin: string;
  submitRegister: string;
  haveAccount: string;
  noAccount: string;
  backHome: string;
}

const localizations: Record<string, Translations> = {
  vi: {
    titleLogin: "Đăng nhập",
    titleRegister: "Tạo tài khoản",
    subtitleLogin: "Đăng nhập hệ thống quản lý TiniX Trending",
    subtitleRegister: "Tài khoản đầu tiên được đăng ký sẽ tự động có quyền Admin",
    usernameLabel: "Tên đăng nhập",
    passwordLabel: "Mật khẩu",
    submitLogin: "Đăng nhập",
    submitRegister: "Đăng ký",
    haveAccount: "Đã có tài khoản? Đăng nhập",
    noAccount: "Chưa có tài khoản? Đăng ký ngay",
    backHome: "Quay lại Trang chủ",
  },
  en: {
    titleLogin: "Sign In",
    titleRegister: "Create Account",
    subtitleLogin: "Sign in to TiniX Trending Admin Panel",
    subtitleRegister: "The first registered user will automatically be assigned the Admin role",
    usernameLabel: "Username",
    passwordLabel: "Password",
    submitLogin: "Sign In",
    submitRegister: "Sign Up",
    haveAccount: "Already have an account? Sign In",
    noAccount: "Don't have an account? Sign Up now",
    backHome: "Back to Homepage",
  },
};

export default function LoginPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = use(params);
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || `/${locale}/admin`;

  const [mode, setMode] = useState<"login" | "register">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [captchaSvg, setCaptchaSvg] = useState<string | null>(null);
  const [captchaInput, setCaptchaInput] = useState("");
  const [captchaLoading, setCaptchaLoading] = useState(false);

  const fetchCaptcha = async () => {
    setCaptchaLoading(true);
    try {
      const res = await fetch("/api/captcha");
      const data = await res.json();
      if (data.svg) {
        setCaptchaSvg(data.svg);
      }
    } catch (err) {
      console.error("Failed to load captcha", err);
    } finally {
      setCaptchaLoading(false);
    }
  };

  React.useEffect(() => {
    if (mode === "register") {
      fetchCaptcha();
    }
  }, [mode]);

  const t = localizations[locale] || localizations.vi;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const url = mode === "login" ? "/api/auth/login" : "/api/auth/register";

    try {
      const payload: any = { username, password };
      if (mode === "register") {
        payload.captchaText = captchaInput;
      }

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Đã xảy ra lỗi");
      }

      // Successful auth: full page reload to force middleware and headers refresh
      window.location.href = callbackUrl;
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--color-canvas)] flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Decorative Blur Rings */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[var(--color-action-blue)]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[var(--color-action-blue)]/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-[420px] z-10 space-y-6">
        
        {/* Back Link */}
        <div className="flex justify-start">
          <Link
            href={`/${locale}`}
            className="flex items-center gap-1.5 text-xs text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] transition-colors"
          >
            <ArrowLeft size={14} />
            {t.backHome}
          </Link>
        </div>

        {/* Card wrapper */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] shadow-xl rounded-2xl p-8 backdrop-blur-md">
          
          {/* Header */}
          <div className="text-center space-y-2 mb-8">
            <h1 className="text-2xl font-bold text-[var(--color-ink)] tracking-tight">
              {mode === "login" ? t.titleLogin : t.titleRegister}
            </h1>
            <p className="text-xs text-[var(--color-ink-muted-64)] max-w-sm mx-auto leading-relaxed">
              {mode === "login" ? t.subtitleLogin : t.subtitleRegister}
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="flex items-start gap-2.5 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-xs mb-6 animate-fade-in">
              <ShieldAlert className="shrink-0 mt-0.5" size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted-64)] uppercase tracking-wider">
                {t.usernameLabel}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-[var(--color-ink-muted-48)]">
                  <User size={16} />
                </span>
                <input
                  type="text"
                  required
                  disabled={loading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)]/50 focus:outline-none focus:border-[var(--color-action-blue)] transition-colors"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-[var(--color-ink-muted-64)] uppercase tracking-wider">
                {t.passwordLabel}
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-3 text-[var(--color-ink-muted-48)]">
                  <Key size={16} />
                </span>
                <input
                  type="password"
                  required
                  disabled={loading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-4 py-2.5 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)]/50 focus:outline-none focus:border-[var(--color-action-blue)] transition-colors"
                />
              </div>
            </div>

            {/* Captcha Input (Only for Register) */}
            {mode === "register" && (
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-[var(--color-ink-muted-64)] uppercase tracking-wider">
                  Mã xác nhận
                </label>
                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center p-2 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-xl">
                  <div className="flex items-center gap-2">
                    <div 
                      className="bg-white rounded-lg border border-[var(--color-divider-soft)] overflow-hidden min-w-[120px] min-h-[40px] flex items-center justify-center relative"
                      dangerouslySetInnerHTML={{ __html: captchaSvg || "" }}
                    >
                      {captchaLoading && (
                        <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-[var(--color-action-blue)]/30 border-t-[var(--color-action-blue)] rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={fetchCaptcha}
                      className="p-1.5 text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] hover:bg-[var(--color-divider-soft)] rounded-lg transition-colors cursor-pointer"
                      title="Tải lại mã"
                    >
                      <RefreshCw size={14} className={captchaLoading ? "animate-spin" : ""} />
                    </button>
                  </div>
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="Nhập mã..."
                    required={mode === "register"}
                    disabled={loading || captchaLoading}
                    className="flex-1 w-full sm:w-auto px-3 py-2 bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-lg text-sm text-[var(--color-ink)] placeholder-[var(--color-ink-muted-48)]/50 focus:outline-none focus:border-[var(--color-action-blue)] transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 bg-[var(--color-action-blue)] hover:bg-[var(--color-action-blue)]/90 text-white rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : mode === "login" ? (
                <>
                  <LogIn size={16} />
                  {t.submitLogin}
                </>
              ) : (
                <>
                  <UserPlus size={16} />
                  {t.submitRegister}
                </>
              )}
            </button>
          </form>

          {/* Toggle Link */}
          <div className="text-center mt-6">
            <button
              onClick={() => {
                setMode(mode === "login" ? "register" : "login");
                setError(null);
              }}
              disabled={loading}
              className="text-xs text-[var(--color-action-blue)] hover:underline focus:outline-none cursor-pointer"
            >
              {mode === "login" ? t.noAccount : t.haveAccount}
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
