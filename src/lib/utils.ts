import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatNumber(num: number): string {
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}k`;
  return num.toLocaleString();
}

export function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "Asia/Ho_Chi_Minh"
  });
}

export function timeAgo(date: string | Date): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 30) return `${diffDays}d ago`;
  return formatDate(date);
}

export function getDeltaColor(delta: number): string {
  if (delta > 0) return "text-emerald-400";
  if (delta < 0) return "text-red-400";
  return "text-zinc-500";
}

export function getDeltaPrefix(delta: number): string {
  if (delta > 0) return "+";
  return "";
}

export function cleanReadme(readme: string | null | undefined): string {
  if (!readme) return "";

  let clean = readme.trim();

  // 1. Strip YAML frontmatter at the beginning of the file
  if (clean.startsWith("---")) {
    const closingIndex = clean.indexOf("---", 3);
    if (closingIndex !== -1) {
      clean = clean.substring(closingIndex + 3).trim();
    }
  }

  // 2. Remove security-sensitive HTML tags (XSS protection & styling leaks)
  clean = clean.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
  clean = clean.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "");
  clean = clean.replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, "");

  // 3. Remove global document structural tags that break React DOM hydration/layout
  clean = clean.replace(/<!DOCTYPE\s+html[^>]*>/gi, "");
  clean = clean.replace(/<\/?html[^>]*>/gi, "");
  clean = clean.replace(/<\/?head[^>]*>/gi, "");
  clean = clean.replace(/<\/?body[^>]*>/gi, "");
  clean = clean.replace(/<meta[^>]*>/gi, "");
  clean = clean.replace(/<title[^>]*>[\s\S]*?<\/title>/gi, "");
  clean = clean.replace(/<link[^>]*>/gi, "");

  return clean.trim();
}

