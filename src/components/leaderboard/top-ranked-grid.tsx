"use client";

import { useState, useEffect } from "react";
import { Link, useRouter } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber, timeAgo } from "@/lib/utils";
import { Star, GitFork, Download, ArrowUpRight, ExternalLink, Trophy, Eye } from "lucide-react";
import { Sparkline } from "@/components/common/sparkline";
import { SourceBadge } from "@/components/common/source-badge";
import { CategoryIcon } from "@/components/common/category-icon";
import { ProjectAvatar } from "@/components/common/project-avatar";
import { useTranslations } from "next-intl";
import { useComparison } from "@/hooks/use-comparison";
import { useSearchParams, useParams } from "next/navigation";

interface TopRankedGridProps {
  projects: RankedProject[];
  days: number;
}

interface RankedCardProps {
  project: RankedProject;
  rank: number;
  isHero?: boolean;
}

export function TopRankedGrid({ projects, days: _days }: TopRankedGridProps) {
  const top1 = projects.find((p) => p.rank === 1) || projects[0];
  const top2 = projects.find((p) => p.rank === 2) || projects[1];
  const top3 = projects.find((p) => p.rank === 3) || projects[2];

  if (!projects || projects.length === 0) return null;

  return (
    <div className="flex flex-col gap-5 mb-8">
      {/* Top 1 - Hero Card */}
      {top1 && <RankedCard project={top1} rank={1} isHero={true} />}

      {/* Top 2 & 3 - Side by Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {top2 && <RankedCard project={top2} rank={2} />}
        {top3 && <RankedCard project={top3} rank={3} />}
      </div>
    </div>
  );
}

function RankedCard({ project, rank, isHero = false }: RankedCardProps) {
  const t = useTranslations("HomePage");
  const tSocial = useTranslations("SocialListening");
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const currentFilter = searchParams.get("filter");
  const locale = (params?.locale as string) || "vi";

  let countryName = "";
  if (project.countryCode) {
    try {
      const displayNames = new Intl.DisplayNames([locale], { type: "region" });
      countryName = displayNames.of(project.countryCode.toUpperCase()) || project.countryCode;
    } catch {
      countryName = project.countryCode;
    }
  }
  const { selectedProjects, addProject, removeProject } = useComparison();
  const isCompared = selectedProjects.some((p) => p.id === project.id);
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

  // Mouse coords for glow effect
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });
  };

  // Border Beam animation for Top 1
  const [beamDeg, setBeamDeg] = useState(0);
  useEffect(() => {
    if (!isHero) return;
    let animationFrameId: number;
    const updateBeam = () => {
      setBeamDeg((prev) => (prev + 1.2) % 360);
      animationFrameId = requestAnimationFrame(updateBeam);
    };
    animationFrameId = requestAnimationFrame(updateBeam);
    return () => cancelAnimationFrame(animationFrameId);
  }, [isHero]);

  const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("a") || 
      target.closest("button") || 
      target.closest(".category-chip") || 
      target.tagName === "A" || 
      target.tagName === "BUTTON"
    ) {
      return;
    }
    router.push(`/project/${project.slug.replace(/\//g, '-')}-${project.id}`);
  };

  const getGrowthText = () => {
    const isGithub = project.source === "github";
    const gained = isGithub ? project.starsGained : (project.downloadsGained ?? 0);
    if (gained <= 0) return null;
    const formatted = formatNumber(gained);
    return `+${formatted}`;
  };

  // Styles based on Rank
  const rankBadgeClass = 
    rank === 1 
      ? "text-amber-500 bg-amber-500/10 border-amber-500/20" 
      : rank === 2 
      ? "text-slate-400 bg-slate-400/10 border-slate-400/20" 
      : "text-amber-700 bg-amber-700/10 border-amber-700/20";

  const cardBorderClass = isHero ? "border-beam-active shadow-lg" : "";

  return (
    <div
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      className={`glass-card glow-interactive hover-spring group relative overflow-hidden cursor-pointer p-6 rounded-2xl border border-[var(--color-divider-soft)] transition-all ${cardBorderClass}`}
      style={{
        "--mouse-x": `${coords.x}px`,
        "--mouse-y": `${coords.y}px`,
        "--beam-deg": `${beamDeg}deg`
      } as React.CSSProperties}
    >
      <div className="flex flex-col h-full justify-between gap-4 relative z-10">
        <div className="flex items-start gap-4">
          {/* Rank Badge */}
          <div className={`rank-badge shrink-0 flex items-center justify-center border font-bold text-sm rounded-xl h-10 w-10 ${rankBadgeClass}`}>
            {rank === 1 ? <Trophy className="h-5 w-5 animate-pulse" /> : rank}
          </div>

          {/* Project Avatar */}
          <ProjectAvatar 
            src={project.ownerAvatarUrl} 
            name={project.fullName} 
            size={isHero ? 48 : 42} 
            className="group-hover:scale-[1.05] transition-transform duration-300 shrink-0" 
          />

          {/* Main Info */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap mb-1.5 w-full">
              <Link
                href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                className="group/link inline-flex items-center gap-1 min-w-0 max-w-full"
              >
                <h3 className={`${isHero ? "text-[19px]" : "text-[16px]"} font-bold text-[var(--color-text-primary)] group-hover/link:text-[var(--color-accent)] transition-colors truncate`}>
                  {project.fullName}
                </h3>
                <ArrowUpRight className="h-4 w-4 text-[var(--color-text-muted)] opacity-0 group-hover/link:opacity-100 transition-all group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 shrink-0" />
              </Link>
              <SourceBadge source={project.source} projectType={project.projectType} />
              {project.countryCode && (
                <img
                  src={`https://flagcdn.com/w20/${project.countryCode.toLowerCase()}.png`}
                  alt={project.countryCode}
                  title={countryName + (project.location ? ` (${project.location})` : "")}
                  className="w-4.5 h-3.5 object-cover rounded-sm shadow-sm border border-[var(--color-border)] select-none shrink-0 hover:scale-110 transition-transform cursor-help"
                />
              )}
              
              {project.mentionsCount !== undefined && project.mentionsCount > 0 && (
                <span className="text-[9px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 select-none">
                  <span className="relative flex h-1 w-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                  </span>
                  {tSocial("discussions", { count: project.mentionsCount })}
                </span>
              )}

              {isNew && (
                <span className="text-[9px] font-semibold bg-[var(--color-accent-dim)] text-[var(--color-accent)] px-1.5 py-0.5 rounded shrink-0">
                  {t("newBadge")}
                </span>
              )}

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (isCompared) {
                    removeProject(project.id);
                  } else {
                    addProject(project);
                  }
                }}
                className={`text-[9px] font-bold tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer select-none shrink-0 ${
                  isCompared 
                    ? "bg-[var(--color-action-blue)] text-white" 
                    : "bg-[var(--color-surface-pearl)] text-[var(--color-ink-muted-80)] border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)]"
                }`}
              >
                {isCompared ? "✓ So sánh" : "+ So sánh"}
              </button>
            </div>

            {/* Description */}
            <p className={`text-[13.5px] text-[var(--color-text-secondary)] mt-1.5 leading-relaxed break-words line-clamp-2 ${isHero ? "md:line-clamp-3" : "line-clamp-2"}`}>
              {project.description}
            </p>
          </div>
        </div>

        {/* Bottom row: categories, stats and sparkline */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 pt-3 border-t border-[var(--color-divider-soft)] mt-1">
          {/* Tags / Categories */}
          <div className="flex flex-wrap gap-1 relative z-10">
            {project.categories.slice(0, isHero ? 3 : 2).map((cat) => (
              <Link
                key={cat.id}
                href={`/?category=${cat.slug}${currentFilter && currentFilter !== "trending" ? `&filter=${currentFilter}` : ""}`}
                className="category-chip transition-all hover:scale-105 active:scale-95 cursor-pointer"
                style={{
                  color: cat.color,
                  backgroundColor: `${cat.color}15`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                }}
              >
                <div className="flex items-center gap-1">
                  <CategoryIcon icon={cat.icon} name={cat.name} className="h-3 w-3 shrink-0" />
                  <span>{cat.name}</span>
                </div>
              </Link>
            ))}
            {project.primaryLanguage && (
              <span className="category-chip text-[var(--color-text-tertiary)] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] select-none">
                {project.primaryLanguage}
              </span>
            )}
          </div>

          {/* Stats and Sparkline */}
          <div className="flex items-center gap-4 shrink-0 justify-between sm:justify-end">
            {/* Sparkline */}
            {project.sparklineData && (
              <div className="flex items-center gap-2">
                <Sparkline data={project.sparklineData} width={isHero ? 100 : 70} height={isHero ? 32 : 24} color="var(--color-accent)" />
              </div>
            )}

            {/* Metrics */}
            <div className="flex flex-col items-end gap-1.5">
              <div className="flex items-center gap-3">
                {project.source === "github" ? (
                  <>
                    <span className="metric-badge">
                      <Star className="text-[var(--color-warning)]" />
                      <span className="text-[var(--color-text-primary)] font-bold">
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
                    <span className="text-[var(--color-text-primary)] font-bold">
                      {formatNumber(project.downloads || 0)}
                    </span>
                  </span>
                )}
                {project.views !== undefined && (
                  <span className="metric-badge" title={`${formatNumber(project.views)} views`}>
                    <Eye className="text-[var(--color-text-tertiary)]" />
                    <span className="text-[var(--color-text-primary)] font-bold">
                      {formatNumber(project.views)}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getGrowthText() && (
                  <span className="delta-positive font-bold text-[11px]">
                    {getGrowthText()}
                  </span>
                )}
                <span className="text-[10px] text-[var(--color-text-tertiary)] opacity-80">
                  {timeAgo(project.sourceUpdatedAt || project.sourceCreatedAt || project.updatedAt)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* External source link */}
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
