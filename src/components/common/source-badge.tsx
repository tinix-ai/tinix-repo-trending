import type { ProjectSource } from "@/types";
import { Github } from "lucide-react";

interface SourceBadgeProps {
  source: ProjectSource;
  size?: "sm" | "md";
}

function HuggingFaceIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 95 88" fill="currentColor" className={className} aria-hidden="true">
      <path d="M47.2 0C26.4 0 9.5 16.9 9.5 37.7c0 3.4.4 6.7 1.3 9.9C4.4 51.3 0 58.3 0 66.3 0 78.6 10 88.6 22.3 88.6c5.9 0 11.3-2.3 15.3-6.1 3 1 6.2 1.5 9.5 1.5 3.4 0 6.6-.5 9.7-1.6 4 3.8 9.4 6.2 15.4 6.2C84.5 88.6 95 78.1 95 65.8c0-7.7-4-14.5-10-18.4.8-3.1 1.2-6.3 1.2-9.7C86.2 16.9 68.5 0 47.2 0z"/>
    </svg>
  );
}

export function SourceBadge({ source, size = "sm" }: SourceBadgeProps) {
  const iconSize = size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";

  if (source === "github") {
    return (
      <span className="inline-flex items-center gap-1 text-zinc-400" title="GitHub">
        <Github className={iconSize} />
      </span>
    );
  }

  if (source === "huggingface") {
    return (
      <span className="inline-flex items-center gap-1 text-amber-400" title="Hugging Face">
        <HuggingFaceIcon className={iconSize} />
      </span>
    );
  }

  return null;
}
