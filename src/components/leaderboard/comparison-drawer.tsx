"use client";

import React from "react";
import { useComparison } from "@/hooks/use-comparison";
import { useRouter } from "@/i18n/routing";
import { BarChart3, Trash2, X } from "lucide-react";

export function ComparisonDrawer() {
  const { selectedProjects, removeProject, clearProjects } = useComparison();
  const router = useRouter();

  if (selectedProjects.length === 0) return null;

  return (
    <>
      <div className="fixed bottom-6 left-4 right-4 md:left-auto md:right-8 md:w-[380px] bg-[var(--color-canvas)] border border-[var(--color-divider-soft)] rounded-2xl shadow-2xl p-4 flex flex-col gap-4 z-40 animate-in slide-in-from-bottom-8 duration-300 ease-out select-none">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-divider-soft)] pb-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[var(--color-action-blue)]/10 text-[var(--color-action-blue)] flex items-center justify-center">
              <BarChart3 className="w-4.5 h-4.5" />
            </div>
            <div>
              <span className="font-bold text-sm text-[var(--color-ink)]">So sánh dự án</span>
              <span className="text-[10px] bg-[var(--color-bg-secondary)] border border-[var(--color-border)] px-1.5 py-0.5 rounded-full ml-1.5 text-[var(--color-ink-muted-80)] font-bold">
                {selectedProjects.length}/3
              </span>
            </div>
          </div>
          <button 
            onClick={clearProjects}
            className="text-[10px] font-semibold text-red-500 hover:text-red-600 flex items-center gap-1 cursor-pointer transition-colors"
            title="Xóa tất cả"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Xóa hết
          </button>
        </div>

        {/* Selected List */}
        <div className="flex flex-col gap-2">
          {selectedProjects.map((project) => (
            <div 
              key={project.id}
              className="flex items-center justify-between bg-[var(--color-surface-pearl)] border border-[var(--color-divider-soft)] px-3 py-2 rounded-xl transition-all"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
                <span className="text-[11px] font-semibold tracking-wider text-[var(--color-ink-muted-48)] shrink-0 select-none">
                  #{project.rank}
                </span>
                <span className="text-xs font-semibold text-[var(--color-ink)] truncate">
                  {project.fullName}
                </span>
              </div>
              <button
                onClick={() => removeProject(project.id)}
                className="w-5 h-5 rounded-full hover:bg-[var(--color-divider-soft)] text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                title="Xóa khỏi danh sách"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>

        {/* Compare Trigger Button */}
        <div className="flex gap-2">
          <button
            onClick={() => {
              const ids = selectedProjects.map((p) => p.id).join(",");
              router.push(`/compare?ids=${ids}`);
            }}
            disabled={selectedProjects.length < 2}
            className="w-full py-2.5 bg-[var(--color-action-blue)] disabled:bg-[var(--color-action-blue)]/50 hover:bg-[var(--color-accent-hover)] text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer disabled:cursor-not-allowed"
          >
            {selectedProjects.length < 2 ? "Chọn tối thiểu 2 dự án" : "So sánh ngay"}
          </button>
        </div>
      </div>
    </>
  );
}
