"use client";

import { Link } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber, getDeltaPrefix, timeAgo } from "@/lib/utils";
import { Sparkline } from "@/components/common/sparkline";
import { SourceBadge } from "@/components/common/source-badge";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";

interface ProjectTableRowProps {
  project: RankedProject;
  index: number;
}

export function ProjectTableRow({ project, index }: ProjectTableRowProps) {
  const searchParams = useSearchParams();
  const currentFilter = searchParams.get("filter");
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNew(
        new Date(project.sourceCreatedAt).getTime() >
        Date.now() - 30 * 24 * 60 * 60 * 1000
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [project.sourceCreatedAt]);

  return (
    <tr
      className={`border-b border-[var(--color-divider-soft)] hover:bg-[var(--color-canvas-parchment)] transition-colors animate-fade-in-up animate-stagger-${Math.min(index + 1, 12)}`}
    >
      {/* Rank */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold tabular-nums ${
            project.rank === 1
              ? "text-amber-500 bg-amber-500/10"
              : project.rank === 2
              ? "text-[var(--color-ink-muted-48)] bg-[var(--color-ink-muted-48)]/10"
              : project.rank === 3
              ? "text-amber-600 bg-amber-600/10"
              : "text-[var(--color-ink-muted-80)]"
          }`}
        >
          {project.rank}
        </span>
      </td>

      {/* Project */}
      <td className="px-4 py-3 max-w-0 w-full">
        <div className="flex items-center gap-2 min-w-0 w-full">
          <Link
            href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
            className="text-sm font-medium text-[var(--color-ink)] hover:text-[var(--color-action-blue)] transition-colors truncate min-w-0 max-w-full"
          >
            {project.fullName}
          </Link>
          <SourceBadge source={project.source} projectType={project.projectType} />
          {isNew && (
            <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-500 bg-emerald-500/10 px-1 py-0.5 rounded shrink-0">
              NEW
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[13px] text-[var(--color-ink-muted-80)] line-clamp-1 break-words">
            {project.description}
          </p>
        </div>
      </td>

      {/* Category */}
      <td className="px-4 py-3 hidden md:table-cell relative z-10">
        {project.categories[0] && (
          <Link
            href={`/?category=${project.categories[0].slug}${currentFilter && currentFilter !== "trending" ? `&filter=${currentFilter}` : ""}`}
            className="inline-flex items-center gap-1 text-[11px] font-medium rounded px-1.5 py-0.5 transition-all hover:scale-105 active:scale-95 cursor-pointer hover:opacity-80"
            style={{
              color: project.categories[0].color,
              backgroundColor: `${project.categories[0].color}15`,
            }}
          >
            {project.categories[0].icon} {project.categories[0].name}
          </Link>
        )}
      </td>

      {/* Language */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <span className="text-xs text-[var(--color-ink-muted-80)]">
          {project.primaryLanguage || "—"}
        </span>
      </td>

      {/* Stars */}
      <td className="px-4 py-3 text-right">
        {project.source === "github" ? (
          <span className="text-sm font-medium text-[var(--color-ink)] tabular-nums flex items-center justify-end gap-1">
            <span className="text-[var(--color-warning)] text-xs">★</span>
            {formatNumber(project.stars)}
          </span>
        ) : (
          <div className="flex flex-col items-end gap-0.5 justify-center select-none">
            <span className="text-sm font-semibold text-rose-500 tabular-nums flex items-center gap-0.5">
              <span>♥</span>
              {formatNumber(project.stars)}
            </span>
            <span className="text-[11px] font-medium text-[var(--color-ink-muted-80)] tabular-nums flex items-center gap-0.5">
              <span>↓</span>
              {formatNumber(project.downloads || 0)}
            </span>
          </div>
        )}
      </td>

      {/* Daily spike */}
      <td className="px-4 py-3 text-right">
        {project.starsGained > 0 ? (
          <span className="delta-positive">
            {getDeltaPrefix(project.starsGained)}
            {formatNumber(project.starsGained)}
          </span>
        ) : (
          <span className="text-xs text-[var(--color-ink-muted-80)]">—</span>
        )}
      </td>

      {/* Updated At */}
      <td className="px-4 py-3 text-right hidden md:table-cell">
        <span className="text-xs text-[var(--color-ink-muted-80)] tabular-nums whitespace-nowrap">
          {timeAgo(project.lastCrawledAt || project.updatedAt)}
        </span>
      </td>

      {/* Sparkline */}
      <td className="px-4 py-3 text-right hidden sm:table-cell">
        {project.sparklineData && (
          <div className="flex justify-end">
            <Sparkline data={project.sparklineData} width={64} height={22} />
          </div>
        )}
      </td>
    </tr>
  );
}
