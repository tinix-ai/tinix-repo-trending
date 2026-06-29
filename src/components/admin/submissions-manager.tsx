"use client";

import { useState, useEffect } from "react";
import { Check, X, ExternalLink, Github, Loader2, User } from "lucide-react";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { actionGetSubmissions, actionApproveSubmission, actionRejectSubmission } from "@/app/actions";

interface Submission {
  id: string;
  url: string;
  source: string;
  status: string;
  preAnalysisData: any;
  submittedAt: Date;
  submitter?: {
    id: string;
    username: string | null;
  } | null;
}

export function SubmissionsManager() {
  const t = useTranslations("SubmissionsManager");
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"pending" | "approved" | "rejected" | "all">("all");

  useEffect(() => {
    loadSubmissions();
  }, []);

  const loadSubmissions = async () => {
    setIsLoading(true);
    try {
      const data = await actionGetSubmissions();
      setSubmissions(data as any);
    } catch (error) {
      toast.error("Failed to load submissions");
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await actionApproveSubmission(id);
      if (res.success) {
        toast.success(t("approveSuccess"));
        setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'approved' } : s));
      } else {
        toast.error(res.error || t("actionFailed"));
      }
    } catch (error) {
      toast.error(t("actionFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setProcessingId(id);
    try {
      const res = await actionRejectSubmission(id);
      if (res.success) {
        toast.success(t("rejectSuccess"));
        setSubmissions(submissions.map(s => s.id === id ? { ...s, status: 'rejected' } : s));
      } else {
        toast.error(res.error || t("actionFailed"));
      }
    } catch (error) {
      toast.error(t("actionFailed"));
    } finally {
      setProcessingId(null);
    }
  };

  const filteredSubmissions = submissions.filter(s => filter === "all" ? true : s.status === filter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--color-ink-muted-48)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 mb-6">
        <button 
          onClick={() => setFilter("all")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'all' ? 'bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]' : 'text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]'}`}
        >
          {t("filterAll")}
        </button>
        <button 
          onClick={() => setFilter("pending")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'pending' ? 'bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]' : 'text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]'}`}
        >
          {t("filterPending")}
        </button>
        <button 
          onClick={() => setFilter("approved")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'approved' ? 'bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]' : 'text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]'}`}
        >
          {t("filterApproved")}
        </button>
        <button 
          onClick={() => setFilter("rejected")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filter === 'rejected' ? 'bg-[var(--color-bg-primary)] text-[var(--color-ink)] shadow-sm border border-[var(--color-border)]' : 'text-[var(--color-ink-muted-80)] hover:bg-[var(--color-surface-elevated)]'}`}
        >
          {t("filterRejected")}
        </button>
      </div>

      {filteredSubmissions.length === 0 ? (
        <div className="flex flex-col items-center justify-center p-12 bg-[var(--color-bg-secondary)] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] text-center">
          <div className="w-12 h-12 bg-[var(--color-bg-primary)] rounded-full flex items-center justify-center mb-4">
            <Check className="w-6 h-6 text-[var(--color-action-green)]" />
          </div>
          <h3 className="text-apple-body-strong text-[var(--color-ink)] mb-1">{t("noSubmissions")}</h3>
          <p className="text-apple-footnote text-[var(--color-ink-muted-64)]">{t("noSubmissionsDesc", { filter: filter !== 'all' ? t(`filter${filter.charAt(0).toUpperCase() + filter.slice(1)}`) : '' })}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSubmissions.map((sub) => (
            <div key={sub.id} className="bg-[var(--color-bg-primary)] rounded-[var(--radius-xl)] border border-[var(--color-hairline)] p-4 sm:p-5 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
              <div className="flex items-start gap-4 flex-1">
                {sub.preAnalysisData?.avatar ? (
                  <img src={sub.preAnalysisData.avatar} alt="Avatar" className="w-12 h-12 rounded-[var(--radius-md)] object-cover bg-[var(--color-bg-secondary)]" />
                ) : (
                  <div className="w-12 h-12 rounded-[var(--radius-md)] bg-[var(--color-bg-secondary)] flex items-center justify-center text-[var(--color-ink-muted-64)]">
                    {sub.source === 'github' ? <Github className="w-6 h-6" /> : sub.source === 'huggingface' ? <div className="w-6 h-6 text-xl">🤗</div> : <div className="w-6 h-6 text-xl">🔗</div>}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <a href={sub.url} target="_blank" rel="noopener noreferrer" className="text-apple-body-strong text-[var(--color-ink)] hover:text-[var(--color-action-blue)] truncate transition-colors flex items-center gap-1">
                      {sub.preAnalysisData?.fullName || sub.preAnalysisData?.name || sub.url}
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <span className="px-2 py-0.5 rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] text-[10px] font-medium uppercase tracking-wider">
                      {sub.source}
                    </span>
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      sub.status === 'approved' ? 'bg-emerald-500/10 text-emerald-600' :
                      sub.status === 'rejected' ? 'bg-red-500/10 text-red-600' :
                      'bg-amber-500/10 text-amber-600'
                    }`}>
                      {sub.status === 'approved' ? t("statusApproved") : sub.status === 'rejected' ? t("statusRejected") : t("statusPending")}
                    </span>
                  </div>
                  <p className="text-apple-footnote text-[var(--color-ink-muted-80)] line-clamp-2 mb-2">
                    {sub.preAnalysisData?.description || t("noDescription")}
                  </p>
                  <div className="flex items-center gap-4 text-[11px] text-[var(--color-ink-muted-64)]">
                    {sub.submitter ? (
                       <span className="flex items-center gap-1">
                         <User className="w-3.5 h-3.5" />
                         {sub.submitter.username || t("unknownUser")}
                       </span>
                    ) : (
                       <span className="flex items-center gap-1">
                         <User className="w-3.5 h-3.5" /> {t("unknownUser")}
                       </span>
                    )}
                    <span>{t("submittedAt", { date: new Date(sub.submittedAt).toLocaleDateString() })}</span>
                  </div>
                </div>
              </div>
              
              {sub.status === 'pending' && (
                <div className="flex items-center gap-2 sm:self-center">
                  <button
                    onClick={() => handleReject(sub.id)}
                    disabled={processingId === sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] text-[var(--color-status-error)] hover:bg-[var(--color-status-error)]/10 text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
                    {t("reject")}
                  </button>
                  <button
                    onClick={() => handleApprove(sub.id)}
                    disabled={processingId === sub.id}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--radius-md)] bg-[var(--color-action-blue)] text-white hover:bg-[var(--color-action-blue)]/90 text-[13px] font-medium transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {processingId === sub.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {t("approve")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
