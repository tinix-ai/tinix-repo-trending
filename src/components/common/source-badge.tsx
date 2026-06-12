import type { ProjectSource } from "@/types";

interface SourceBadgeProps {
  source: ProjectSource;
  projectType?: "repository" | "model" | "dataset";
  size?: "sm" | "md";
}

export function SourceBadge({ source, projectType = "repository", size = "sm" }: SourceBadgeProps) {
  const isSm = size === "sm";
  const paddingCls = isSm ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-xs";

  if (source === "github") {
    return (
      <span
        className={`inline-flex items-center gap-1 font-medium rounded-full bg-zinc-100 text-zinc-700 dark:bg-zinc-800/60 dark:text-zinc-300 border border-zinc-200/40 dark:border-zinc-700/30 transition-colors shrink-0 ${paddingCls}`}
        title="GitHub Repository"
      >
        <span>🐱</span>
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
        <span>🤗</span>
        <span>{label}</span>
      </span>
    );
  }

  return null;
}
