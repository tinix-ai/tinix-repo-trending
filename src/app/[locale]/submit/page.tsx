"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Send, CheckCircle2, AlertCircle, Loader2, ArrowRight, Github, ExternalLink, PenLine } from "lucide-react";

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
    <main className="min-h-screen bg-[var(--color-canvas)] flex flex-col items-center pt-10 sm:pt-16 pb-24 px-4 relative overflow-hidden">
      {/* Premium Background Effects */}
      <div className="absolute top-[-20%] left-[20%] w-[60%] h-[60%] bg-[var(--color-action-blue)]/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-[var(--color-action-blue)]/5 rounded-full blur-[100px] pointer-events-none" />
      
      <div className="w-full max-w-xl z-10">
        
        {/* Sleek, integrated Header */}
        <div className="text-center mb-8 animate-fade-in-up">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--color-action-blue)] to-blue-600 shadow-lg shadow-blue-500/20 mb-5 relative">
            <div className="absolute inset-0 bg-white/20 rounded-2xl border border-white/30"></div>
            <Send className="h-6 w-6 text-white relative z-10 ml-0.5" />
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-[var(--color-ink)] mb-3">
            {t("title")}
          </h1>
          <p className="text-[15px] text-[var(--color-ink-muted-64)] max-w-md mx-auto leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Main Content Card Wrapper */}
        <div className="relative animate-fade-in-up" style={{ animationDelay: '100ms' }}>
          
          {step !== 'success' && (
            <div className="flex bg-[var(--color-bg-secondary)] p-1 rounded-[var(--radius-pill)] border border-[var(--color-divider-soft)] mb-8 w-max mx-auto shadow-sm relative z-20">
              <button 
                onClick={() => { setSubmissionType('link'); setStep('input'); setError(""); }} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all select-none ${submissionType === 'link' ? 'bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-md scale-[1.02]' : 'text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)]'}`}
              >
                Link Repository (GH/HF)
              </button>
              <button 
                onClick={() => { setSubmissionType('custom'); setStep('custom_form'); setPreAnalysisData({}); setError(""); }} 
                className={`px-6 py-2 rounded-full text-sm font-semibold transition-all select-none ${submissionType === 'custom' ? 'bg-[var(--color-ink)] text-[var(--color-canvas)] shadow-md scale-[1.02]' : 'text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)]'}`}
              >
                Custom Project
              </button>
            </div>
          )}

          <div className="bg-[var(--color-bg-primary)]/80 backdrop-blur-xl border border-[var(--color-divider-soft)] shadow-2xl shadow-black/5 rounded-[24px] overflow-hidden">
            
            {step === 'input' && submissionType === 'link' && (
              <div className="p-6 sm:p-10">
                <form onSubmit={handlePreAnalyze} className="flex flex-col gap-6">
                  <div className="flex flex-col gap-2.5">
                    <label htmlFor="url" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1">
                      Repository URL
                    </label>
                    <div className="relative group">
                      <div className="absolute -inset-0.5 bg-gradient-to-r from-[var(--color-action-blue)] to-blue-400 rounded-[var(--radius-xl)] opacity-0 group-focus-within:opacity-20 transition duration-300 blur-sm"></div>
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
                        className="relative w-full h-12 rounded-[var(--radius-xl)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-5 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-ink-muted-48)] outline-none transition-all duration-200 focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] disabled:opacity-50 shadow-inner"
                      />
                    </div>
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)] animate-fade-in">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending || !url.trim()}
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-ink)] text-[var(--color-canvas)] text-sm font-semibold transition-all duration-300 hover:bg-[var(--color-ink)]/90 hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
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
              <div className="flex flex-col animate-fade-in">
                <div className="p-6 sm:p-10 border-b border-[var(--color-divider-soft)] bg-gradient-to-b from-[var(--color-bg-secondary)] to-[var(--color-bg-primary)]">
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="relative">
                      {preAnalysisData?.avatar ? (
                        <img src={preAnalysisData.avatar} alt="Avatar" className="w-20 h-20 rounded-[var(--radius-xl)] object-cover bg-white p-1 shadow-md border border-[var(--color-divider-soft)]" />
                      ) : (
                        <div className="w-20 h-20 rounded-[var(--radius-xl)] bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] flex items-center justify-center text-[var(--color-ink-muted-64)] shadow-inner">
                          {sourceInfo.source === 'github' ? <Github className="w-10 h-10" /> : <span className="text-3xl">🤗</span>}
                        </div>
                      )}
                      <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] text-[var(--color-ink)] text-[10px] font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 whitespace-nowrap">
                        {sourceInfo.source === 'github' ? <Github className="w-3 h-3" /> : '🤗'}
                        {sourceInfo.source}
                      </div>
                    </div>
                    
                    <div className="mt-4">
                      <h4 className="text-2xl font-bold text-[var(--color-ink)] mb-1">{preAnalysisData?.name}</h4>
                      <p className="text-sm font-medium text-[var(--color-ink-muted-64)]">{preAnalysisData?.fullName}</p>
                    </div>
                    
                    {preAnalysisData?.stars !== undefined && (
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--color-action-blue)]/5 border border-[var(--color-action-blue)]/20 mt-1">
                        <span className="text-lg font-bold text-[var(--color-action-blue)]">{preAnalysisData.stars.toLocaleString()}</span>
                        <span className="text-xs font-semibold text-[var(--color-action-blue)]/70 uppercase tracking-widest">{sourceInfo.source === 'github' ? 'Stars' : 'Likes'}</span>
                      </div>
                    )}
                    
                    <textarea
                      value={preAnalysisData?.description || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, description: e.target.value })}
                      placeholder="Enter a short description..."
                      className="mt-4 w-full max-w-sm text-sm text-[var(--color-ink-muted-80)] bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-xl p-3 outline-none focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] resize-none shadow-inner"
                      rows={3}
                    />
                  </div>
                </div>

                <div className="p-6 sm:p-10 bg-[var(--color-canvas)]/50">
                  {error && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)] mb-6 animate-fade-in">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <div className="flex flex-col sm:flex-row gap-3">
                    <button
                      onClick={() => { setStep('input'); setError(""); }}
                      disabled={isPending}
                      className="flex-1 h-12 flex items-center justify-center rounded-[var(--radius-xl)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] text-[var(--color-ink)] text-sm font-semibold transition-colors hover:bg-[var(--color-bg-secondary)] active:scale-[0.98] disabled:opacity-50 cursor-pointer shadow-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSubmit}
                      disabled={isPending}
                      className="flex-[2] group relative flex h-12 items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-action-blue)] text-white text-sm font-semibold transition-all hover:bg-[var(--color-action-blue-focus)] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
                    >
                      {isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Submitting...</span>
                        </>
                      ) : (
                        <>
                          <span>{t("button")}</span>
                          <Send className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 'custom_form' && submissionType === 'custom' && (
              <div className="p-6 sm:p-10 animate-fade-in">
                <form onSubmit={handleSubmitCustom} className="flex flex-col gap-6">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1">Project Name *</label>
                      <input
                        type="text"
                        value={preAnalysisData?.name || ''}
                        onChange={(e) => setPreAnalysisData({ ...preAnalysisData, name: e.target.value })}
                        placeholder="e.g. TiniX Workflow"
                        className="w-full h-11 rounded-[var(--radius-lg)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1">Homepage URL</label>
                      <input
                        type="url"
                        value={preAnalysisData?.homepageUrl || ''}
                        onChange={(e) => setPreAnalysisData({ ...preAnalysisData, homepageUrl: e.target.value })}
                        placeholder="https://example.com"
                        className="w-full h-11 rounded-[var(--radius-lg)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1">Short Description *</label>
                    <textarea
                      value={preAnalysisData?.description || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, description: e.target.value })}
                      placeholder="A crisp, one-sentence tagline for the project."
                      className="w-full min-h-[80px] py-3 rounded-[var(--radius-lg)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] resize-y"
                      required
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1 flex justify-between items-center">
                      <span>Readme (Markdown)</span>
                      <span className="text-[10px] text-[var(--color-ink-muted-48)] normal-case tracking-normal">Optional</span>
                    </label>
                    <textarea
                      value={preAnalysisData?.readme || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, readme: e.target.value })}
                      placeholder="# Introduction&#10;Describe your project in detail..."
                      className="w-full min-h-[160px] font-mono py-3 rounded-[var(--radius-lg)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)] resize-y"
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-[11px] font-bold uppercase tracking-wider text-[var(--color-ink-muted-64)] ml-1">Logo / Avatar URL</label>
                    <input
                      type="url"
                      value={preAnalysisData?.avatar || ''}
                      onChange={(e) => setPreAnalysisData({ ...preAnalysisData, avatar: e.target.value })}
                      placeholder="https://example.com/logo.png"
                      className="w-full h-11 rounded-[var(--radius-lg)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] px-4 text-sm text-[var(--color-ink)] outline-none transition-colors focus:border-[var(--color-action-blue)] focus:ring-1 focus:ring-[var(--color-action-blue)]"
                    />
                  </div>

                  {error && (
                    <div className="flex items-start gap-3 rounded-[var(--radius-lg)] bg-[var(--color-status-error)]/10 border border-[var(--color-status-error)]/20 p-4 text-[var(--color-status-error)] animate-fade-in">
                      <AlertCircle className="h-5 w-5 shrink-0 mt-0.5" />
                      <p className="text-sm font-medium">{error}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={isPending || !preAnalysisData?.name || !preAnalysisData?.description}
                    className="group relative flex h-12 w-full items-center justify-center gap-2 overflow-hidden rounded-[var(--radius-xl)] bg-[var(--color-action-blue)] text-white text-sm font-semibold transition-all duration-300 hover:bg-[var(--color-action-blue-focus)] hover:shadow-lg active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none mt-2 cursor-pointer"
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
              <div className="p-10 sm:p-14 flex flex-col items-center text-center animate-fade-in">
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 to-emerald-600 text-white rounded-full flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/20 ring-8 ring-emerald-500/10">
                  <CheckCircle2 className="w-10 h-10" />
                </div>
                <h3 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--color-ink)] mb-4">Project Submitted!</h3>
                <p className="text-[15px] text-[var(--color-ink-muted-64)] mb-10 max-w-sm leading-relaxed">
                  Your project is now in the queue. An admin will review it shortly. Track the status from your Dashboard.
                </p>
                <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
                  <button
                    onClick={() => { setSubmissionType('link'); setStep('input'); setUrl(""); setPreAnalysisData({}); }}
                    className="h-12 px-8 flex items-center justify-center rounded-[var(--radius-pill)] border border-[var(--color-divider-soft)] bg-[var(--color-canvas)] text-[var(--color-ink)] text-sm font-semibold transition-colors hover:bg-[var(--color-bg-secondary)] active:scale-[0.98] cursor-pointer shadow-sm"
                  >
                    Submit Another
                  </button>
                  <a 
                    href="/dashboard"
                    className="h-12 px-8 flex items-center justify-center rounded-[var(--radius-pill)] bg-[var(--color-ink)] text-[var(--color-canvas)] text-sm font-semibold transition-all hover:bg-[var(--color-ink)]/90 hover:shadow-lg active:scale-[0.98] cursor-pointer"
                  >
                    Go to Dashboard
                  </a>
                </div>
              </div>
            )}
          </div>
          
          {step !== 'success' && (
            <div className="mt-8 text-center text-[13px] text-[var(--color-ink-muted-48)] px-4">
              <p>{t("spamNote")}</p>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
