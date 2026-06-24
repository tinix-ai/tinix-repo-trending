"use client";

import React, { useState } from "react";
import { Database, TrendingUp } from "lucide-react";

interface StatsCardsProps {
  totalProjects: number;
  trendingProjects: number;
  totalProjectsLabel: string;
  trendingProjectsLabel: string;
}

export function StatsCards({
  totalProjects,
  trendingProjects,
  totalProjectsLabel,
  trendingProjectsLabel,
}: StatsCardsProps) {
  const [coordsCard1, setCoordsCard1] = useState({ x: 0, y: 0 });
  const [coordsCard2, setCoordsCard2] = useState({ x: 0, y: 0 });

  const handleMouseMoveCard1 = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoordsCard1({ x, y });
  };

  const handleMouseMoveCard2 = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    setCoordsCard2({ x, y });
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
      {/* Total Projects Card */}
      <div
        onMouseMove={handleMouseMoveCard1}
        className="apple-utility-card hover-spring glow-interactive p-6 flex items-center gap-6 cursor-pointer relative overflow-hidden"
        style={{
          "--mouse-x": `${coordsCard1.x}px`,
          "--mouse-y": `${coordsCard1.y}px`,
        } as React.CSSProperties}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-500 shrink-0 relative z-10">
          <Database className="h-8 w-8" />
        </div>
        <div className="relative z-10">
          <p className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-1 font-semibold">
            {totalProjectsLabel}
          </p>
          <p className="text-4xl font-bold text-[var(--color-ink)] tabular-nums">
            {totalProjects.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Trending Projects Card */}
      <div
        onMouseMove={handleMouseMoveCard2}
        className="apple-utility-card hover-spring glow-interactive p-6 flex items-center gap-6 cursor-pointer relative overflow-hidden"
        style={{
          "--mouse-x": `${coordsCard2.x}px`,
          "--mouse-y": `${coordsCard2.y}px`,
        } as React.CSSProperties}
      >
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-500 shrink-0 relative z-10">
          <TrendingUp className="h-8 w-8" />
        </div>
        <div className="relative z-10">
          <p className="text-apple-caption text-[var(--color-ink-muted-80)] uppercase tracking-wider mb-1 font-semibold">
            {trendingProjectsLabel}
          </p>
          <p className="text-4xl font-bold text-[var(--color-ink)] tabular-nums">
            {trendingProjects.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}
