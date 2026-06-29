import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/common/page-header";
import { actionGetUserProjects } from "@/app/actions";
import { FolderGit2, Clock, CheckCircle2, XCircle, ExternalLink, Eye, Heart } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function DashboardPage(props: { params: Promise<{ locale: string }> }) {
  const params = await props.params;
  const { locale } = params;
  const t = await getTranslations(); 
  const res = await actionGetUserProjects();

  if (!res.success && res.error === "Unauthorized") {
    redirect(`/${locale}/login`);
  }

  const projects = res.projects || [];

  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <PageHeader
        title={t("Dashboard.title")}
        subtitle={t("Dashboard.subtitle")}
      />

      <div className="max-w-4xl mx-auto mt-8 animate-fade-in-up">
        {projects.length === 0 ? (
          <div className="glass-card p-12 text-center flex flex-col items-center">
            <div className="w-16 h-16 rounded-full bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center mb-4">
              <FolderGit2 className="w-8 h-8 text-[var(--color-ink-muted-48)]" />
            </div>
            <h3 className="text-xl font-bold text-[var(--color-ink)] mb-2">{t("Dashboard.noProjects")}</h3>
            <p className="text-[var(--color-ink-muted-64)] mb-6 max-w-sm">
              {t("Dashboard.noProjectsDesc")}
            </p>
            <Link
              href={`/${locale}/submit`}
              className="px-6 py-2.5 rounded-[var(--radius-pill)] bg-[var(--color-action-blue)] text-white text-sm font-medium transition-colors hover:bg-[var(--color-action-blue-focus)]"
            >
              {t("Dashboard.submitProject")}
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {projects.map((p) => {
              const data = p.preAnalysisData as any;
              return (
                <div key={p.id} className="glass-card p-5 sm:p-6 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
                  {/* Avatar */}
                  <div className="shrink-0">
                    {data?.avatar ? (
                      <img src={data.avatar} alt="" className="w-14 h-14 rounded-xl object-cover bg-white p-1 border border-[var(--color-hairline)]" />
                    ) : (
                      <div className="w-14 h-14 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] flex items-center justify-center text-[var(--color-ink-muted-48)]">
                        <FolderGit2 className="w-6 h-6" />
                      </div>
                    )}
                  </div>
                  
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h4 className="text-lg font-bold text-[var(--color-ink)] truncate">
                        {data?.name || p.sourceId}
                      </h4>
                      <span className="px-2 py-0.5 rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] border border-[var(--color-hairline)] text-[10px] uppercase tracking-wider font-semibold text-[var(--color-ink-muted-64)]">
                        {p.source}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-ink-muted-80)] truncate mb-3">
                      {data?.description || t("Dashboard.noDescription")}
                    </p>
                    
                    <div className="flex flex-wrap items-center gap-4 text-xs font-medium">
                      {/* Status */}
                      <div className="flex items-center gap-1.5">
                        {p.status === 'approved' ? (
                          <><CheckCircle2 className="w-4 h-4 text-[var(--color-status-success)]" /><span className="text-[var(--color-status-success)]">{t("Dashboard.statusApproved")}</span></>
                        ) : p.status === 'rejected' ? (
                          <><XCircle className="w-4 h-4 text-[var(--color-status-error)]" /><span className="text-[var(--color-status-error)]">{t("Dashboard.statusRejected")}</span></>
                        ) : (
                          <><Clock className="w-4 h-4 text-[var(--color-status-warning)]" /><span className="text-[var(--color-status-warning)]">{t("Dashboard.statusPending")}</span></>
                        )}
                      </div>
                      
                      <div className="w-1 h-1 rounded-full bg-[var(--color-hairline)]" />
                      
                      {/* Date */}
                      <span className="text-[var(--color-ink-muted-64)]">
                        {t("Dashboard.submittedAt", { date: new Date(p.submittedAt).toLocaleDateString() })}
                      </span>
                    </div>
                  </div>
                  
                  {/* Actions / Stats */}
                  <div className="flex items-center gap-4 mt-4 sm:mt-0 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 border-[var(--color-hairline)] pt-4 sm:pt-0">
                    <div className="flex items-center gap-4">
                      {p.status === 'approved' && (
                        <>
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]" title="Views">
                            <Eye className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
                            <span>{p.views?.toLocaleString() || 0}</span>
                          </div>
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-[var(--color-ink)]" title="Likes">
                            <Heart className="w-4 h-4 text-[var(--color-ink-muted-48)]" />
                            <span>{p.likes?.toLocaleString() || 0}</span>
                          </div>
                        </>
                      )}
                    </div>
                    
                    {p.projectSlug ? (
                      <Link
                        href={`/${locale}/projects/${p.projectSlug}`}
                        className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors"
                        title="View Project Detail"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </Link>
                    ) : p.url && !p.url.startsWith('custom://') ? (
                      <a
                        href={p.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 rounded-full hover:bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)] transition-colors"
                        title="Visit Source"
                      >
                        <ExternalLink className="w-5 h-5" />
                      </a>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
