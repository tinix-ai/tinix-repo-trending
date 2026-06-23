"use client";

import React from "react";
import { Link } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber } from "@/lib/utils";
import { Star, Download, BarChart3, Code2 } from "lucide-react";
import { SourceBadge } from "@/components/common/source-badge";
import { useTranslations } from "next-intl";
import { useComparison } from "@/hooks/use-comparison";

interface SimilarProjectsProps {
  projects: RankedProject[];
}

export function SimilarProjects({ projects }: SimilarProjectsProps) {
  const t = useTranslations("ProjectDetail");
  const { selectedProjects, addProject, removeProject } = useComparison();

  if (!projects || projects.length === 0) return null;

  return (
    <div className="w-full border-t border-[var(--color-divider-soft)] pt-12 mt-12">
      <div className="flex flex-col gap-2 mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-[var(--color-ink)]">
          {t("similarProjects")}
        </h2>
        <p className="text-sm text-[var(--color-ink-muted-80)]">
          {t("similarProjectsDesc")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {projects.map((project) => {
          const isCompared = selectedProjects.some((p) => p.id === project.id);
          const isGithub = project.source === "github";
          
          return (
            <div
              key={project.id}
              className="bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-[2px] p-5 flex flex-col justify-between hover:border-[var(--color-action-blue)]/50 hover:shadow-lg transition-all duration-300 ease-out group"
            >
              <div className="flex flex-col gap-3">
                {/* Header info */}
                <div className="flex items-center justify-between gap-2">
                  <SourceBadge source={project.source} projectType={project.projectType} />
                  {project.primaryLanguage && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold uppercase text-[var(--color-ink-muted-48)] select-none">
                      <Code2 className="h-3 w-3" />
                      {project.primaryLanguage}
                    </span>
                  )}
                </div>

                {/* Project Title */}
                <Link
                  href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                  className="font-bold text-base text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors line-clamp-1 break-all"
                >
                  {project.fullName}
                </Link>

                {/* Description */}
                <p className="text-xs text-[var(--color-ink-muted-80)] line-clamp-3 leading-relaxed">
                  {project.description || "No description provided."}
                </p>
              </div>

              {/* Footer info & action buttons */}
              <div className="flex items-center justify-between border-t border-[var(--color-divider-soft)] pt-4 mt-5">
                {/* Stats */}
                <div className="flex items-center gap-3">
                  {isGithub ? (
                    <div className="flex items-center gap-1 text-xs text-[var(--color-ink)] font-semibold select-none">
                      <Star className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                      <span>{formatNumber(project.stars)}</span>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-1 text-xs text-[var(--color-ink)] font-semibold select-none">
                        <Star className="h-3.5 w-3.5 text-[var(--color-warning)]" />
                        <span>{formatNumber(project.stars)}</span>
                      </div>
                      <div className="flex items-center gap-1 text-xs text-[var(--color-ink-muted-80)] select-none">
                        <Download className="h-3.5 w-3.5 text-[var(--color-info)]" />
                        <span>{formatNumber(project.downloads || 0)}</span>
                      </div>
                    </>
                  )}
                </div>

                {/* Add to compare button */}
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    if (isCompared) {
                      removeProject(project.id);
                    } else {
                      // RankedProject conversion for comparison state
                      addProject(project);
                    }
                  }}
                  className={`text-[10px] font-bold tracking-wider px-2.5 py-1.5 rounded-[2px] transition-all duration-200 cursor-pointer select-none flex items-center gap-1.5 ${
                    isCompared
                      ? "bg-[var(--color-action-blue)] text-white"
                      : "bg-[var(--color-bg-secondary)] text-[var(--color-ink-muted-80)] border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)] hover:border-[var(--color-border-hover)]"
                  }`}
                >
                  <BarChart3 className="h-3 w-3" />
                  {isCompared ? "✓ " + t("addToCompare") : "+ " + t("addToCompare")}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
