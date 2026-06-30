"use client";

import { useEffect, useState } from "react";
import { fetchDynamicRankings } from "@/app/actions";
import type { RankedProject } from "@/types";
import { Link } from "@/i18n/routing";
import { Github, TrendingUp, Zap } from "lucide-react";
import { formatNumber } from "@/lib/utils";
import Image from "next/image";

export function TrendingMarquee() {
  const [projects, setProjects] = useState<RankedProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTrending() {
      try {
        const { projects } = await fetchDynamicRankings({
          limit: 20,
          offset: 0,
          filterType: "trending",
          days: 7, // week trend
        });
        setProjects(projects);
      } catch (error) {
        console.error("Failed to load marquee projects", error);
      } finally {
        setLoading(false);
      }
    }
    loadTrending();
  }, []);

  if (loading || projects.length === 0) return null;

  return (
    <div className="w-full border-b border-[var(--color-divider-soft)] bg-[var(--color-bg-primary)] overflow-hidden relative group">
      
      {/* Absolute Gradient overlays for smooth fading edges */}
      <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[var(--color-bg-primary)] to-transparent z-10 pointer-events-none"></div>
      <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[var(--color-bg-primary)] to-transparent z-10 pointer-events-none"></div>

      {/* Marquee Wrapper */}
      <div className="flex w-max shrink-0 animate-custom-marquee [will-change:transform]">
        {/* Double the list for infinite seamless scrolling */}
        {[...projects, ...projects].map((project, index) => {
          const isGithub = project.source === "github";
          const starsOrLikes = isGithub ? project.stars : project.likes;
          const trendValue = project.starsGained;
          const url = `/project/${project.slug.replace(/\//g, '-')}-${project.id}`;

          return (
            <Link
              href={url}
              key={`${project.id}-${index}`}
              className="flex items-center gap-3 px-6 py-2 border-r border-[var(--color-divider-soft)] hover:bg-[var(--color-bg-secondary)] transition-colors min-w-max cursor-pointer"
            >
              <div className="relative w-5 h-5 rounded-md overflow-hidden bg-[var(--color-surface-elevated)] shrink-0 flex items-center justify-center border border-[var(--color-border)]">
                {project.ownerAvatarUrl ? (
                  <Image
                    src={project.ownerAvatarUrl}
                    alt={project.fullName}
                    width={20}
                    height={20}
                    className="object-cover"
                    unoptimized
                  />
                ) : isGithub ? (
                  <Github className="w-3 h-3 text-[var(--color-ink-muted-80)]" />
                ) : (
                  <div className="text-[9px] font-bold">HF</div>
                )}
              </div>
              <span className="text-[13px] font-semibold text-[var(--color-ink)] max-w-[150px] truncate">
                {project.name}
              </span>
              <div className="flex items-center gap-2">
                <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--color-ink-muted-80)]">
                  {isGithub ? (
                    <svg className="w-3 h-3" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M8 .25a.75.75 0 0 1 .673.418l1.882 3.815 4.21.612a.75.75 0 0 1 .416 1.279l-3.046 2.97.719 4.192a.75.75 0 0 1-1.088.791L8 12.347l-3.766 1.98a.75.75 0 0 1-1.088-.79l.72-4.194L.818 6.374a.75.75 0 0 1 .416-1.28l4.21-.611L7.327.668A.75.75 0 0 1 8 .25Z" />
                    </svg>
                  ) : (
                    <Zap className="w-3 h-3" />
                  )}
                  {formatNumber(starsOrLikes || 0)}
                </span>
                
                {trendValue && trendValue > 0 ? (
                  <span className="flex items-center text-[10px] font-bold text-[var(--color-positive)] bg-[var(--color-positive)]/10 px-1.5 py-0.5 rounded">
                    <TrendingUp className="w-2.5 h-2.5 mr-0.5" />
                    +{formatNumber(trendValue)}
                  </span>
                ) : null}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
