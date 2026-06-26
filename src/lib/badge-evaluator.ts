import type { RankedProject } from "@/types";

export interface ProjectBadge {
  id: string;
  label: string;
  type: "trophy-1" | "trophy-2" | "trophy-3" | "trend" | "star-magnet" | "new" | "popular";
  colorClass: string; // Tailwind class
  icon: string; // Emoji or reference name
}

export function evaluateProjectBadges(project: RankedProject): ProjectBadge[] {
  const badges: ProjectBadge[] = [];

  // 1. Trophy badges
  if (project.rank === 1) {
    badges.push({
      id: "rank-1",
      label: "Top 1 Trending",
      type: "trophy-1",
      colorClass: "bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20",
      icon: "🏆",
    });
  } else if (project.rank === 2) {
    badges.push({
      id: "rank-2",
      label: "Top 2 Trending",
      type: "trophy-2",
      colorClass: "bg-slate-400/10 text-slate-600 border border-slate-400/20 dark:bg-slate-400/10 dark:text-slate-300 dark:border-slate-400/20",
      icon: "🥈",
    });
  } else if (project.rank === 3) {
    badges.push({
      id: "rank-3",
      label: "Top 3 Trending",
      type: "trophy-3",
      colorClass: "bg-amber-700/10 text-amber-800 border border-amber-700/20 dark:bg-amber-700/10 dark:text-amber-400 dark:border-amber-700/20",
      icon: "🥉",
    });
  }

  // 2. High growth trend badge
  const isGithub = project.source === "github";
  const gained = isGithub ? project.starsGained : (project.downloadsGained ?? 0);
  
  if (gained >= 150 && isGithub) {
    badges.push({
      id: "hot-trend",
      label: "Hottest Trend",
      type: "trend",
      colorClass: "bg-red-500/10 text-red-600 border border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
      icon: "🔥",
    });
  } else if (gained >= 1000 && !isGithub) {
    badges.push({
      id: "hot-trend-hf",
      label: "Hottest Trend",
      type: "trend",
      colorClass: "bg-red-500/10 text-red-600 border border-red-500/20 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20",
      icon: "🔥",
    });
  }

  // 3. New Entry badge
  const isProjectNew = new Date(project.sourceCreatedAt).getTime() > Date.now() - 30 * 24 * 60 * 60 * 1000;
  if (isProjectNew) {
    badges.push({
      id: "new-entry",
      label: "New Project",
      type: "new",
      colorClass: "bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20",
      icon: "🌱",
    });
  }

  // 4. Star magnet or super popular
  const totalWeight = isGithub ? project.stars : (project.downloads ?? 0);
  if (isGithub && totalWeight > 15000) {
    badges.push({
      id: "star-magnet",
      label: "Star Magnet",
      type: "star-magnet",
      colorClass: "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
      icon: "⭐",
    });
  } else if (!isGithub && totalWeight > 50000) {
    badges.push({
      id: "download-magnet",
      label: "Super Popular",
      type: "popular",
      colorClass: "bg-blue-500/10 text-blue-600 border border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/20",
      icon: "🚀",
    });
  }

  return badges;
}
