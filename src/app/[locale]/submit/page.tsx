"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowRight, Github, ExternalLink, PenLine } from "lucide-react";
import { PageHeader } from "@/components/common/page-header";
import { actionPreAnalyzeUrl, actionSubmitProject } from "@/app/actions";

type Step = 'input' | 'preview' | 'custom_form' | 'success';
type SubmissionType = 'link' | 'custom';

export default function SubmitPage() {
  const t = useTranslations("Submit");
  const [submissionType, setSubmissionType] = useState<SubmissionType>('link');
  const [step, setStep] = useState<Step>('input');
  
  const [url, setUrl] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState("");
  const [preAnalysisData, setPreAnalysisData] = useState<any>({});
  const [sourceInfo, setSourceInfo] = useState<any>(null);

  const handlePreAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim()) return;
    
    setIsPending(true);
    setError("");
    
    try {
      const res = await actionPreAnalyzeUrl(url);
      if (res.success) {
        setPreAnalysisData(res.preAnalysisData);
        setSourceInfo(res.info);
        setStep('preview');
      } else {
        setError(res.error || t("errorUrl"));
      }
    } catch (err) {
      setError(t("errorUrl"));
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmit = async () => {
    setIsPending(true);
    setError("");
    
    try {
      const res = await actionSubmitProject(url, preAnalysisData, false);
      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || t("errorUrl"));
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  const handleSubmitCustom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!preAnalysisData.name || !preAnalysisData.description) {
      setError("Project name and description are required.");
      return;
    }
    
    setIsPending(true);
    setError("");
    
    try {
      const res = await actionSubmitProject(preAnalysisData.homepageUrl || undefined, preAnalysisData, true);
      if (res.success) {
        setStep('success');
      } else {
        setError(res.error || "Failed to submit custom project.");
      }
    } catch (err) {
      setError("An unexpected error occurred.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <main className="min-h-screen bg-[var(--color-canvas)] pb-24">
      {/* Edge-to-edge Hero Tile */}
      <section className="apple-tile-light py-24 sm:py-32 border-b border-[var(--color-divider-soft)] relative overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute inset-0 bg-gradient-to-b from-[var(--color-action-blue)]/5 to-transparent pointer-events-none" />
        
        <div className="page-container relative z-10 flex flex-col items-center text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-[var(--radius-lg)] bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] mb-2">
            <Send className="h-5 w-5 text-[var(--color-action-blue)]" />
          </div>
          
          <PageHeader 
            title={t("title")} 
            subtitle={t("subtitle")} 
            className="!mt-2"
          />
        </div>
      </section>

      {/* Main Content */}
      <section className="pt-12">
        <div className="page-container max-w-xl">
          
          {step !== 'success' && (
            <div className="flex bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-pill)] border border-[var(--color-divider-soft)] mb-8 w-max mx-auto animate-fade-in-up">
              <button 
                onClick={() => { setSubmissionType('link'); setStep('input'); setError(""); }} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all select-none ${submissionType === 'link' ? 'bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-md' : 'text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)]'}`}
              >
                Link Repository (GH/HF)
              </button>
              <button 
                onClick={() => { setSubmissionType('custom'); setStep('custom_form'); setPreAnalysisData({}); setError(""); }} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all select-none ${submissionType === 'custom' ? 'bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-md' : 'text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)]'}`}
              >
                Custom Project
              </button>
            </div>
          )}

          {step === 'input' && submissionType === 'link' && (
            <div className="glass-card hover-spring p-6 sm:p-10 animate-fade-in-up">
              <form onSubmit={handlePreAnalyze} className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <label htmlFor="url" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1">
                    URL
                  </label>
                  <input
                    type="url"
                    id="url"
                    name="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder={t("inputPlaceholder")}
                    required
                    autoComplete="off"
                    disabled={isPending}
                    className="w-full h-11 rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] px-5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none transition-all duration-200 focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] disabled:opacity-50 disabled:cursor-not-allowed"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)]">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || !url.trim()}
                  className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-[var(--color-canvas)] text-sm font-medium transition-all duration-300 hover:bg-[var(--color-ink)]/90 active:scale-[0.95] disabled:opacity-70 disabled:pointer-events-none mt-2 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>Continue</span>
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'preview' && sourceInfo && (
            <div className="flex flex-col gap-6 animate-fade-in-up">
              <div className="glass-card p-6 sm:p-8">
                <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-6 text-center">
                  Project Preview
                </h3>
                
                <div className="bg-[var(--color-bg-secondary)] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] p-5 mb-6 flex flex-col items-center text-center gap-4">
                  {preAnalysisData?.avatar ? (
                    <img src={preAnalysisData.avatar} alt="Avatar" className="w-16 h-16 rounded-[var(--radius-lg)] object-cover bg-white p-1" />
                  ) : (
                    <div className="w-16 h-16 rounded-[var(--radius-lg)] bg-[var(--color-bg-primary)] flex items-center justify-center text-[var(--color-ink-muted-64)]">
                      {sourceInfo.source === 'github' ? <Github className="w-8 h-8" /> : <span className="text-2xl">🤗</span>}
                    </div>
                  )}
                  
                  <div>
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-primary)] border border-[var(--color-hairline)] text-[var(--color-ink-muted-64)] text-[10px] font-medium uppercase tracking-wider">
                        {sourceInfo.source}
                      </span>
                    </div>
                    <h4 className="text-xl font-bold text-[var(--color-ink)] mb-2">{preAnalysisData?.name}</h4>
                    <p className="text-sm text-[var(--color-ink-muted-64)]">{preAnalysisData?.fullName}</p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 mt-2">
                    {preAnalysisData?.stars !== undefined && (
                      <div className="flex flex-col items-center">
                        <span className="text-[11px] uppercase tracking-wider text-[var(--color-ink-muted-48)] font-semibold mb-1">Stars/Likes</span>
                        <span className="text-lg font-bold text-[var(--color-ink)]">{preAnalysisData.stars.toLocaleString()}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-sm text-[var(--color-ink-muted-80)] max-w-sm mt-2">
                    {preAnalysisData?.description || "No description provided"}
                  </p>
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)] mb-6">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    onClick={() => { setStep('input'); setError(""); }}
                    disabled={isPending}
                    className="flex-1 h-11 flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-hairline)] bg-[var(--color-canvas)] text-[var(--color-ink)] text-sm font-medium transition-colors hover:bg-[var(--color-bg-secondary)] disabled:opacity-50 cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={isPending}
                    className="flex-[2] group relative flex h-11 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-action-blue)] text-white text-sm font-medium transition-all hover:bg-[var(--color-action-blue-focus)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none cursor-pointer"
                  >
                    {isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Submitting...</span>
                      </>
                    ) : (
                      <>
                        <span>{t("button")}</span>
                        <Send className="h-3.5 w-3.5" />
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'custom_form' && submissionType === 'custom' && (
            <div className="glass-card p-6 sm:p-8 animate-fade-in-up">
              <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-6 text-center flex items-center justify-center gap-2">
                <PenLine className="w-5 h-5 text-[var(--color-action-blue)]" />
                Custom Project Details
              </h3>
              
              <form onSubmit={handleSubmitCustom} className="flex flex-col gap-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1">Project Name *</label>
                    <input
                      type="text"
                      value={preAnalysisData?.name || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, name: e.target.value })}
                      placeholder="e.g. Awesome SaaS"
                      className="w-full h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1">Homepage URL</label>
                    <input
                      type="url"
                      value={preAnalysisData?.homepageUrl || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, homepageUrl: e.target.value })}
                      placeholder="https://example.com"
                      className="w-full h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1">Short Description *</label>
                  <textarea
                    value={preAnalysisData?.description || ''}
                    onChange={(e) => setPreAnalysisData({ ...preAnalysisData, description: e.target.value })}
                    placeholder="A one sentence tagline for the project."
                    className="w-full min-h-[80px] py-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] resize-y"
                    required
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1 flex justify-between items-center">
                    <span>Readme (Markdown)</span>
                    <span className="text-[10px] text-[var(--color-ink-muted-48)] font-normal normal-case">Optional, highly recommended</span>
                  </label>
                  <textarea
                    value={preAnalysisData?.readme || ''}
                    onChange={(e) => setPreAnalysisData({ ...preAnalysisData, readme: e.target.value })}
                    placeholder="# Introduction&#10;Describe your project in detail..."
                    className="w-full min-h-[250px] font-mono py-3 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] resize-y"
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-80)] ml-1">Logo / Avatar URL</label>
                  <input
                    type="url"
                    value={preAnalysisData?.avatar || ''}
                    onChange={(e) => setPreAnalysisData({ ...preAnalysisData, avatar: e.target.value })}
                    placeholder="https://example.com/logo.png"
                    className="w-full h-11 rounded-[var(--radius-md)] border border-[var(--color-hairline)] bg-[var(--color-bg-secondary)] px-4 text-sm text-[var(--color-ink)] outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                  />
                </div>

                {error && (
                  <div className="flex items-start gap-3 rounded-[var(--radius-md)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)] mt-2">
                    <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                    <p className="text-sm font-medium">{error}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isPending || !preAnalysisData?.name || !preAnalysisData?.description}
                  className="group relative flex h-11 w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-pill)] bg-[var(--color-action-blue)] text-white text-sm font-medium transition-all duration-300 hover:bg-[var(--color-action-blue-focus)] active:scale-[0.98] disabled:opacity-70 disabled:pointer-events-none mt-4 cursor-pointer"
                >
                  {isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <span>Submit Custom Project</span>
                      <Send className="h-4 w-4" />
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

          {step === 'success' && (
            <div className="glass-card p-10 flex flex-col items-center text-center animate-fade-in-up">
              <div className="w-16 h-16 bg-[var(--color-action-green)]/10 text-[var(--color-action-green)] rounded-full flex items-center justify-center mb-6">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-2xl font-bold tracking-tight text-[var(--color-ink)] mb-3">Project Submitted!</h3>
              <p className="text-[var(--color-ink-muted-80)] mb-8">
                Your project has been placed in the approval queue. An administrator will review it before it enters the global ranking. You can view the status in your Dashboard.
              </p>
              <div className="flex gap-4">
                <button
                  onClick={() => { setSubmissionType('link'); setStep('input'); setUrl(""); setPreAnalysisData({}); }}
                  className="h-11 px-6 flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-bg-secondary)] text-[var(--color-ink)] text-sm font-medium transition-colors hover:bg-[var(--color-hairline)] cursor-pointer"
                >
                  Submit another project
                </button>
                <a 
                  href="/dashboard/projects"
                  className="h-11 px-6 flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-action-blue)] text-white text-sm font-medium transition-colors hover:bg-[var(--color-action-blue-focus)] cursor-pointer"
                >
                  Go to My Projects
                </a>
              </div>
            </div>
          )}

          {step !== 'success' && (
            <div className="mt-8 text-center text-sm text-[var(--color-ink-muted-48)]">
              <p>{t("spamNote")}</p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
