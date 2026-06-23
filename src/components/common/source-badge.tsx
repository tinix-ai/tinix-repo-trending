import type { ProjectSource } from "@/types";
import { Github } from "lucide-react";

interface SourceBadgeProps {
  source: ProjectSource;
  projectType?: "repository" | "model" | "dataset";
  size?: "sm" | "md";
}

export function SourceBadge({ source, projectType = "repository", size = "sm" }: SourceBadgeProps) {
  const isSm = size === "sm";
  const paddingCls = isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";
  const iconCls = isSm ? "w-3 h-3" : "w-3.5 h-3.5";

  if (source === "github") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200/40 dark:border-zinc-700/30 transition-colors shrink-0 ${paddingCls}`}
        title="GitHub Repository"
      >
        <Github className={iconCls} />
        <span>Repository</span>
      </span>
    );
  }

  if (source === "huggingface") {
    const isModel = projectType === "model";
    const label = isModel ? "Model" : "Dataset";
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-200/40 dark:border-amber-500/20 transition-colors shrink-0 ${paddingCls}`}
        title={`Hugging Face ${label}`}
      >
        <svg 
          className={iconCls} 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
        >
          <path d="M18 10h-.01" />
          <path d="M6 10h-.01" />
          <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2z" />
          <path d="M8 15a5 5 0 0 0 8 0" />
        </svg>
        <span>{label}</span>
      </span>
    );
  }

  return null;
}

