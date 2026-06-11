"use client";

import { Link } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber, getDeltaPrefix } from "@/lib/utils";
import { Star, GitFork, Download, ArrowUpRight, ExternalLink } from "lucide-react";
import { Sparkline } from "@/components/common/sparkline";
import { SourceBadge } from "@/components/common/source-badge";

interface ProjectCardProps {
  project: RankedProject;
  index: number;
}

function RankBadge({ rank }: { rank: number }) {
  const cls =
    rank === 1
      ? "rank-1"
      : rank === 2
      ? "rank-2"
      : rank === 3
      ? "rank-3"
      : "rank-default";

  return <div className={`rank-badge ${cls}`}>{rank}</div>;
}

export function ProjectCard({ project, index }: ProjectCardProps) {
  const isNew =
    new Date(project.sourceCreatedAt).getTime() >
    Date.now() - 30 * 24 * 60 * 60 * 1000;

  return (
    <div
      className={`card group relative overflow-hidden animate-fade-in-up animate-stagger-${Math.min(index + 1, 12)}`}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <RankBadge rank={project.rank} />

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Header Row */}
            <div className="flex items-center gap-2 mb-1">
              <SourceBadge source={project.source} />
              {isNew && (
                <span className="text-[10px] font-semibold tracking-wider uppercase bg-[var(--color-accent-dim)] text-[var(--color-accent)] px-1.5 py-0.5 rounded">
                  NEW
                </span>
              )}
            </div>

            {/* Project Name */}
            <Link
              href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
              className="group/link inline-flex items-center gap-1.5"
            >
              <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)] group-hover/link:text-[var(--color-accent)] transition-colors truncate">
                {project.fullName}
              </h3>
              <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 group-hover/link:opacity-100 transition-all group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5" />
            </Link>

            {/* Description */}
            <p className="text-[14px] text-[var(--color-text-secondary)] line-clamp-2 mt-1 leading-relaxed">
              {project.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3">
              {project.categories.slice(0, 2).map((cat) => (
                <span
                  key={cat.id}
                  className="category-chip"
                  style={{
                    color: cat.color,
                    backgroundColor: `${cat.color}15`,
                  }}
                >
                  {cat.icon} {cat.name}
                </span>
              ))}
              {project.primaryLanguage && (
                <span className="category-chip text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  {project.primaryLanguage}
                </span>
              )}
            </div>
          </div>

          {/* Right Column: Metrics + Sparkline */}
          <div className="hidden sm:flex flex-col items-end gap-3 shrink-0">
            {/* Star delta */}
            <div className="flex items-center gap-2">
              {project.starsGained > 0 && (
                <span className="delta-positive">
                  {getDeltaPrefix(project.starsGained)}
                  {formatNumber(project.starsGained)}
                </span>
              )}
            </div>

            {/* Sparkline */}
            {project.sparklineData && (
              <Sparkline data={project.sparklineData} color="var(--color-accent)" />
            )}

            {/* Metrics row */}
            <div className="flex items-center gap-3">
              {project.source === "github" ? (
                <>
                  <span className="metric-badge">
                    <Star className="text-[var(--color-warning)]" />
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {formatNumber(project.stars)}
                    </span>
                  </span>
                  <span className="metric-badge">
                    <GitFork />
                    {formatNumber(project.forks)}
                  </span>
                </>
              ) : (
                <span className="metric-badge">
                  <Download className="text-[var(--color-info)]" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatNumber(project.downloads || 0)}
                  </span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Mobile metrics */}
        <div className="sm:hidden flex items-center justify-between mt-3 pt-3 border-t border-[var(--color-border)]">
          <div className="flex items-center gap-3">
            {project.source === "github" ? (
              <>
                <span className="metric-badge">
                  <Star className="text-[var(--color-warning)]" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatNumber(project.stars)}
                  </span>
                </span>
                <span className="metric-badge">
                  <GitFork />
                  {formatNumber(project.forks)}
                </span>
              </>
            ) : (
              <span className="metric-badge">
                <Download className="text-[var(--color-info)]" />
                <span className="text-[var(--color-text-primary)] font-medium">
                  {formatNumber(project.downloads || 0)}
                </span>
              </span>
            )}
          </div>
          {project.starsGained > 0 && (
            <span className="delta-positive">
              {getDeltaPrefix(project.starsGained)}
              {formatNumber(project.starsGained)}
            </span>
          )}
        </div>
      </div>

      {/* Source link */}
      <a
        href={project.sourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="absolute top-4 right-4 flex items-center justify-center h-8 w-8 rounded-full text-[var(--color-text-muted)] opacity-0 group-hover:opacity-100 transition-all hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]"
        aria-label={`Open ${project.fullName} on ${project.source}`}
      >
        <ExternalLink className="h-4 w-4" />
      </a>
    </div>
  );
}
