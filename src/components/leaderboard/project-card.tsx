"use client";

import { Link, useRouter } from "@/i18n/routing";
import type { RankedProject } from "@/types";
import { formatNumber, timeAgo } from "@/lib/utils";
import { Sparkline } from "@/components/common/sparkline";
import { SourceBadge } from "@/components/common/source-badge";
import { CategoryIcon } from "@/components/common/category-icon";
import { ArrowUpRight, Github, GitFork, Eye, Globe, Code2, Link as LinkIcon, AlertCircle, Calendar, Package, Share2, Trophy, Flame, Sprout, Star, Rocket, Download, ExternalLink } from "lucide-react";
import { ProjectAvatar } from "@/components/common/project-avatar";

import { useState, useEffect } from "react";
import { useSearchParams, useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useComparison } from "@/hooks/use-comparison";
import { evaluateProjectBadges } from "@/lib/badge-evaluator";
import { ShareModal } from "@/components/leaderboard/share-modal";

const getBadgeIcon = (type: string, className: string = "w-3.5 h-3.5") => {
  switch (type) {
    case "trophy-1": return <Trophy className={`${className} text-amber-500`} />;
    case "trophy-2": return <Trophy className={`${className} text-slate-400`} />;
    case "trophy-3": return <Trophy className={`${className} text-amber-700`} />;
    case "trend": return <Flame className={`${className} text-red-500`} />;
    case "star-magnet": return <Star className={`${className} text-blue-500`} />;
    case "new": return <Sprout className={`${className} text-emerald-500`} />;
    case "popular": return <Rocket className={`${className} text-purple-500`} />;
    default: return null;
  }
};

interface ProjectCardProps {
  project: RankedProject;
  index: number;
  days: number;
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

function buildCategoryHref(slug: string, filter: string | null) {
  const params = new URLSearchParams();
  params.set("category", slug);
  if (filter && filter !== "trending") params.set("filter", filter);
  return `/?${params.toString()}`;
}

export function ProjectCard({ project, index, days: _days }: ProjectCardProps) {
  const t = useTranslations("HomePage");
  const tSocial = useTranslations("SocialListening");
  const searchParams = useSearchParams();
  const params = useParams();
  const router = useRouter();
  const currentFilter = searchParams.get("filter");
  const [isNew, setIsNew] = useState(false);
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
  const [coords, setCoords] = useState({ x: 0, y: 0 });
  const [isShareOpen, setIsShareOpen] = useState(false);
  const badges = evaluateProjectBadges(project);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoords({ x, y });
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsNew(
          new Date(project.sourceCreatedAt).getTime() >
          Date.now() - 30 * 24 * 60 * 60 * 1000
      );
    }, 0);
    return () => clearTimeout(timer);
  }, [project.sourceCreatedAt]);

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

  return (
    <div
      onClick={handleCardClick}
      onMouseMove={handleMouseMove}
      className={`glass-card glow-interactive hover-spring group relative overflow-hidden cursor-pointer animate-fade-in-up animate-stagger-${Math.min(index + 1, 12)}`}
      style={{
        "--mouse-x": `${coords.x}px`,
        "--mouse-y": `${coords.y}px`,
      } as React.CSSProperties}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank */}
          <RankBadge rank={project.rank} />

          {/* Project Avatar */}
          <ProjectAvatar 
            src={project.ownerAvatarUrl} 
            name={project.fullName} 
            size={40} 
            className="group-hover:scale-[1.05] transition-transform duration-300 relative z-10 shrink-0" 
          />

          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Project Name & Badges */}
            <div className="flex items-center gap-2 flex-wrap mb-1 min-w-0 w-full">
              <Link
                href={`/project/${project.slug.replace(/\//g, '-')}-${project.id}`}
                className="group/link inline-flex items-center gap-1.5 min-w-0 max-w-full"
              >
                <h3 className="text-[17px] font-semibold text-[var(--color-text-primary)] group-hover/link:text-[var(--color-accent)] transition-colors truncate">
                  {project.fullName}
                </h3>
                <ArrowUpRight className="h-3.5 w-3.5 text-[var(--color-text-muted)] opacity-0 group-hover/link:opacity-100 transition-all group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5 shrink-0" />
              </Link>
              <SourceBadge source={project.source} projectType={project.projectType} iconOnly />
              {project.countryCode && (
                <img
                  src={`https://flagcdn.com/w20/${project.countryCode.toLowerCase()}.png`}
                  alt={project.countryCode}
                  title={countryName + (project.location ? ` (${project.location})` : "")}
                  className="w-4.5 h-3.5 object-cover rounded-sm shadow-sm border border-[var(--color-border)] select-none shrink-0 hover:scale-110 transition-transform cursor-help"
                />
              )}
              
              {project.mentionsCount !== undefined && project.mentionsCount > 0 && (
                <span className="text-[10px] font-bold tracking-wider uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-1 select-none">
                  <span className="relative flex h-1 w-1">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1 w-1 bg-emerald-500"></span>
                  </span>
                  {tSocial("discussions", { count: project.mentionsCount })}
                </span>
              )}

              {badges.length > 0 && (
                <div className="flex items-center gap-0.5 shrink-0 ml-1">
                  {badges.map((badge) => (
                    <span
                      key={badge.id}
                      className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-surface-pearl)] border border-[var(--color-divider-soft)] shadow-sm hover:scale-110 transition-transform cursor-help shrink-0"
                      title={badge.label}
                    >
                      {getBadgeIcon(badge.type, "w-3.5 h-3.5")}
                    </span>
                  ))}
                </div>
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
                className={`text-[10px] font-bold tracking-wider px-2 py-0.5 rounded transition-all cursor-pointer select-none shrink-0 ml-1 ${
                  isCompared 
                    ? "bg-[var(--color-action-blue)] text-white" 
                    : "bg-[var(--color-surface-pearl)] text-[var(--color-ink-muted-80)] border border-[var(--color-border)] hover:bg-[var(--color-divider-soft)]"
                }`}
              >
                {isCompared ? "✓ So sánh" : "+ So sánh"}
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setIsShareOpen(true);
                }}
                className="flex items-center justify-center w-6 h-6 rounded-full bg-[var(--color-surface-pearl)] text-[var(--color-action-blue)] border border-[var(--color-border)] shadow-sm hover:bg-[var(--color-divider-soft)] hover:scale-110 transition-all cursor-pointer shrink-0"
                title="Share & PR"
              >
                <Share2 className="h-3 w-3" />
              </button>
            </div>

            {/* Description */}
            <p className="text-[14px] text-[var(--color-text-secondary)] line-clamp-2 mt-1 leading-relaxed break-words">
              {project.description}
            </p>

            {/* Tags */}
            <div className="flex flex-wrap gap-1.5 mt-3 relative z-10">
              {project.categories.slice(0, 2).map((cat) => (
                <Link
                  key={cat.id}
                  href={buildCategoryHref(cat.slug, currentFilter)}
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
              {project.topics && project.topics.slice(0, 4).map((topic) => (
                <Link
                  key={topic}
                  href={`/?tag=${encodeURIComponent(topic)}`}
                  className="category-chip text-[var(--color-action-blue)] bg-[var(--color-action-blue)]/5 border border-[var(--color-action-blue)]/10 hover:bg-[var(--color-action-blue)]/10 hover:text-[var(--color-action-blue-focus)] transition-all cursor-pointer font-medium"
                  onClick={(e) => {
                    e.stopPropagation();
                  }}
                >
                  #{topic}
                </Link>
              ))}
            </div>
          </div>

          {/* Right Column: Metrics + Sparkline */}
          <div className="hidden sm:flex flex-col items-end gap-3 shrink-0">
            {/* Star/Download delta */}
            <div className="flex items-center gap-2">
              {getGrowthText() && (
                <span className="delta-positive font-medium text-xs">
                  {getGrowthText()}
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
                <>
                  <span className="metric-badge">
                    <span className="text-rose-500 text-xs">♥</span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {formatNumber(project.likes || 0)}
                    </span>
                  </span>
                  <span className="metric-badge">
                    <Download className="text-[var(--color-info)] shrink-0 h-3.5 w-3.5" />
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {formatNumber(project.downloads || 0)}
                    </span>
                  </span>
                </>
              )}
              {project.views !== undefined && project.views > 0 && (
                <span className="metric-badge" title={`${formatNumber(project.views)} views`}>
                  <Eye className="text-[var(--color-text-tertiary)]" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatNumber(project.views)}
                  </span>
                </span>
              )}
            </div>

            {/* Updated time info */}
            <span className="text-[11px] text-[var(--color-text-tertiary)] select-none opacity-80" title="Source Updated">
              {t("updated", { time: timeAgo(project.sourceUpdatedAt || project.sourceCreatedAt || project.updatedAt) })}
            </span>
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
              <>
                <span className="metric-badge">
                  <span className="text-rose-500 text-xs">♥</span>
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatNumber(project.likes || 0)}
                  </span>
                </span>
                <span className="metric-badge">
                  <Download className="text-[var(--color-info)] shrink-0 h-3.5 w-3.5" />
                  <span className="text-[var(--color-text-primary)] font-medium">
                    {formatNumber(project.downloads || 0)}
                  </span>
                </span>
              </>
            )}
            {project.views !== undefined && project.views > 0 && (
              <span className="metric-badge" title={`${formatNumber(project.views)} views`}>
                <Eye className="text-[var(--color-text-tertiary)]" />
                <span className="text-[var(--color-text-primary)] font-medium">
                  {formatNumber(project.views)}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getGrowthText() && (
              <span className="delta-positive font-medium text-xs">
                {getGrowthText()}
              </span>
            )}
            <span className="text-[11px] text-[var(--color-text-tertiary)]" title="Source Updated">
              {t("updated", { time: timeAgo(project.sourceUpdatedAt || project.sourceCreatedAt || project.updatedAt) })}
            </span>
          </div>
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

      <ShareModal
        project={project}
        days={_days}
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
      />
    </div>
  );
}
