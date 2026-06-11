"use client";

import { Link } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber, getDeltaPrefix } from "@/lib/utils";
import { Sparkline } from "@/components/common/sparkline";
import { SourceBadge } from "@/components/common/source-badge";

import { useState, useEffect } from "react";

interface ProjectTableRowProps {
  project: RankedProject;
  index: number;
}

export function ProjectTableRow({ project, index }: ProjectTableRowProps) {
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
      className={`border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors animate-fade-in-up animate-stagger-${Math.min(index + 1, 12)}`}
    >
      {/* Rank */}
      <td className="px-4 py-3">
        <span
          className={`inline-flex items-center justify-center w-7 h-7 rounded-md text-xs font-bold tabular-nums ${
            project.rank === 1
              ? "text-amber-400 bg-amber-400/10"
              : project.rank === 2
              ? "text-slate-300 bg-slate-400/10"
              : project.rank === 3
              ? "text-amber-600 bg-amber-600/10"
              : "text-zinc-600"
          }`}
        >
          {project.rank}
        </span>
      </td>

      {/* Project */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <SourceBadge source={project.source} />
          <Link
            href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
            className="text-sm font-medium text-zinc-200 hover:text-emerald-400 transition-colors truncate"
          >
            {project.fullName}
          </Link>
          {isNew && (
            <span className="text-[9px] font-bold tracking-wider uppercase text-emerald-400 bg-emerald-400/10 px-1 py-0.5 rounded shrink-0">
              NEW
            </span>
          )}
        </div>
        <p className="text-xs text-zinc-600 truncate max-w-xs mt-0.5">
          {project.description}
        </p>
      </td>

      {/* Category */}
      <td className="px-4 py-3 hidden md:table-cell relative z-10">
        {project.categories[0] && (
          <Link
            href={`/?category=${project.categories[0].slug}`}
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
        <span className="text-xs text-zinc-500">
          {project.primaryLanguage || "—"}
        </span>
      </td>

      {/* Stars */}
      <td className="px-4 py-3 text-right">
        <span className="text-sm font-medium text-zinc-300 tabular-nums">
          {formatNumber(project.stars)}
        </span>
      </td>

      {/* Daily spike */}
      <td className="px-4 py-3 text-right">
        {project.starsGained > 0 ? (
          <span className="delta-positive">
            {getDeltaPrefix(project.starsGained)}
            {formatNumber(project.starsGained)}
          </span>
        ) : (
          <span className="text-xs text-zinc-700">—</span>
        )}
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
