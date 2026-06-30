"use client";

import React, { useState } from "react";
import { EmbedBadgeDialog } from "./embed-badge-dialog";
import { Code2, Trophy, Medal, Award } from "lucide-react";

interface Achievement {
  achievementType: string;
  rank: number;
  scope: string; // "global" or "language:TypeScript"
  period: "daily" | "weekly" | "monthly";
  achievedAt: string;
}

interface AchievementBadgesProps {
  projectId: string;
  projectName: string;
  achievements: Achievement[];
}

export function AchievementBadges({ projectId, projectName, achievements }: AchievementBadgesProps) {
  const [isEmbedOpen, setIsEmbedOpen] = useState(false);

  if (!achievements || achievements.length === 0) return null;

  const sortedAchievements = [...achievements].sort(
    (a, b) => new Date(b.achievedAt).getTime() - new Date(a.achievedAt).getTime()
  );
  
  // Lấy tối đa 2 thành tựu mới nhất (1 global, 1 language nếu có, hoặc 2 cái bất kỳ)
  const latestAchievements = sortedAchievements.slice(0, 2);

  if (latestAchievements.length === 0) return null;

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
  };

  const getRankColors = (rank: number) => {
    if (rank === 1) return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-700/50", medal: Trophy };
    if (rank === 2) return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700", medal: Medal };
    return { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-500", border: "border-orange-200 dark:border-orange-800/50", medal: Award };
  };

  const getPeriodTitle = (period: string) => {
    if (period === "daily") return "Repository Của Ngày";
    if (period === "weekly") return "Repository Của Tuần";
    return "Repository Của Tháng";
  };

  const renderBadgeCard = (ach: Achievement) => {
    const isGlobal = ach.scope === "global";
    const language = isGlobal ? null : ach.scope.replace("language:", "");
    const colors = getRankColors(ach.rank);
    const Icon = colors.medal;
    
    return (
      <div key={`${ach.achievementType}-${ach.achievedAt}`} className="group flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-primary)] border border-[var(--color-border)] hover:border-[var(--color-action-blue)]/40 hover:shadow-sm transition-all duration-200 cursor-default">
        {/* Medal Graphic */}
        <div className={`relative flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center border-2 ${colors.bg} ${colors.border} shadow-sm group-hover:scale-105 transition-transform duration-300`}>
          <Icon className={`w-5 h-5 ${colors.text}`} />
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center font-bold text-[9px] ${colors.bg} ${colors.text}`}>
            {ach.rank}
          </div>
        </div>
        
        {/* Text Info */}
        <div className="flex flex-col min-w-0 flex-1">
          <div className="flex items-center gap-1.5 uppercase tracking-wider text-[9px] sm:text-[10px] font-bold text-[var(--color-action-blue)]">
            <span>TINIX TRENDING</span>
            {language && (
              <>
                <span className="text-[var(--color-ink-muted-48)]">·</span>
                <span className="text-[var(--color-ink)] truncate">{language}</span>
              </>
            )}
          </div>
          <h3 className="text-sm font-bold tracking-tight text-[var(--color-ink)] truncate">
            #{ach.rank} {getPeriodTitle(ach.period)}
          </h3>
        </div>

        {/* Date */}
        <div className="hidden sm:block text-[11px] font-medium text-[var(--color-ink-muted-48)] whitespace-nowrap pl-2">
          {formatDate(ach.achievedAt)}
        </div>
      </div>
    );
  };

  return (
    <div className="w-full">
      <div className="apple-utility-card overflow-hidden">
        <div className="flex items-center justify-between p-4 sm:p-5 border-b border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)]/50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-100 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700/50 shadow-sm">
              <Trophy className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <h2 className="text-sm font-bold tracking-tight text-[var(--color-ink)]">
                Thành tựu nổi bật
              </h2>
              <p className="text-[11px] text-[var(--color-ink-muted-80)]">
                Những danh hiệu mới nhất của dự án
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => setIsEmbedOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--color-canvas)] border border-[var(--color-border)] hover:border-[var(--color-action-blue)] hover:text-[var(--color-action-blue)] text-xs font-semibold text-[var(--color-ink-muted-80)] transition-colors"
          >
            <Code2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Nhúng Badge</span>
            <span className="sm:hidden">Nhúng</span>
          </button>
        </div>

        <div className="p-4 sm:p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {latestAchievements.map(renderBadgeCard)}
          </div>
        </div>
      </div>

      <EmbedBadgeDialog 
        projectId={projectId}
        projectName={projectName}
        isOpen={isEmbedOpen}
        onClose={() => setIsEmbedOpen(false)}
      />
    </div>
  );
}
