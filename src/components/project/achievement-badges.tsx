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

  // Group achievements by period for organized display
  const grouped = {
    daily: achievements.filter(a => a.period === "daily"),
    weekly: achievements.filter(a => a.period === "weekly"),
    monthly: achievements.filter(a => a.period === "monthly"),
  };

  const hasAny = grouped.daily.length > 0 || grouped.weekly.length > 0 || grouped.monthly.length > 0;
  if (!hasAny) return null;

  const formatDate = (dateString: string) => {
    const d = new Date(dateString);
    return d.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
  };

  const getRankColors = (rank: number) => {
    if (rank === 1) return { bg: "bg-amber-100 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400", border: "border-amber-200 dark:border-amber-700/50", medal: Trophy };
    if (rank === 2) return { bg: "bg-slate-100 dark:bg-slate-800", text: "text-slate-600 dark:text-slate-300", border: "border-slate-200 dark:border-slate-700", medal: Medal };
    return { bg: "bg-orange-50 dark:bg-orange-950/30", text: "text-orange-700 dark:text-orange-500", border: "border-orange-200 dark:border-orange-800/50", medal: Award };
  };

  const getPeriodTitle = (period: string) => {
    if (period === "daily") return "Repository Of The Day";
    if (period === "weekly") return "Repository Of The Week";
    return "Repository Of The Month";
  };

  const renderBadgeCard = (ach: Achievement) => {
    const isGlobal = ach.scope === "global";
    const language = isGlobal ? null : ach.scope.replace("language:", "");
    const colors = getRankColors(ach.rank);
    const Icon = colors.medal;
    
    const subtext = isGlobal 
      ? `First achieved on ${formatDate(ach.achievedAt)} across all languages`
      : `First achieved on ${formatDate(ach.achievedAt)} for ${language}`;

    return (
      <div key={`${ach.achievementType}-${ach.achievedAt}`} className="flex flex-col gap-3">
        {/* Helper Subtext */}
        <p className="text-sm text-[var(--color-ink-muted-80)]">
          {subtext}
        </p>
        
        {/* The Badge UI */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center p-4 sm:p-5 rounded-2xl border border-[var(--color-divider-soft)] bg-[var(--color-bg-primary)] shadow-sm gap-4 transition-all hover:shadow-md hover:border-[var(--color-action-blue)]/30">
          
          {/* Medal Graphic */}
          <div className={`relative flex-shrink-0 w-14 h-14 rounded-full flex items-center justify-center border-2 ${colors.bg} ${colors.border}`}>
            <Icon className={`w-7 h-7 ${colors.text}`} />
            <div className={`absolute -bottom-2 -right-1 w-6 h-6 rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center font-bold text-xs ${colors.bg} ${colors.text}`}>
              {ach.rank}
            </div>
          </div>
          
          {/* Text Info */}
          <div className="flex flex-col gap-1 w-full">
            <div className="flex items-center gap-1.5 uppercase tracking-widest text-[10px] sm:text-[11px] font-bold text-[var(--color-action-blue)]">
              <span>📈 TINIX TRENDING</span>
              {language && (
                <>
                  <span className="text-[var(--color-ink-muted-48)]">·</span>
                  <span className="text-[var(--color-ink)]">{language}</span>
                </>
              )}
            </div>
            <h3 className="text-lg sm:text-xl font-bold tracking-tight text-[var(--color-ink)]">
              #{ach.rank} {getPeriodTitle(ach.period)}
            </h3>
          </div>
        </div>

        {/* Embed Action */}
        <button 
          onClick={() => setIsEmbedOpen(true)}
          className="self-start mt-1 px-4 py-2 bg-[#5e6ad2] hover:bg-[#4d56ba] text-white text-sm font-semibold rounded-lg shadow-sm flex items-center gap-2 transition-all duration-200 active:scale-95"
        >
          <Code2 className="w-4 h-4" />
          Embed Badge
        </button>
      </div>
    );
  };

  const renderSection = (title: string, data: Achievement[]) => {
    if (!data || data.length === 0) return null;
    
    return (
      <div className="flex flex-col gap-5 mb-10">
        <h2 className="text-xl font-bold tracking-tight text-[var(--color-ink)] border-b border-[var(--color-divider-soft)] pb-2">{title}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-10">
          {data.map(renderBadgeCard)}
        </div>
      </div>
    );
  };

  return (
    <section className="w-full mt-10 mb-6 bg-[var(--color-bg-secondary)] rounded-2xl border border-[var(--color-border)] p-6 md:p-8">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-[var(--color-ink)] flex items-center gap-3">
          🏆 Project Achievements
        </h1>
        <p className="text-[var(--color-ink-muted-80)] mt-2">
          Recognitions awarded by TiniX Trending based on momentum and growth.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {renderSection("Daily", grouped.daily)}
        {renderSection("Weekly", grouped.weekly)}
        {renderSection("Monthly", grouped.monthly)}
      </div>

      <EmbedBadgeDialog 
        projectId={projectId}
        projectName={projectName}
        isOpen={isEmbedOpen}
        onClose={() => setIsEmbedOpen(false)}
      />
    </section>
  );
}
