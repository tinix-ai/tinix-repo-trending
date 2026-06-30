"use client";

import React, { useState, useEffect } from "react";
import { Copy, Check, X, Code2 } from "lucide-react";

interface EmbedBadgeDialogProps {
  projectId: string;
  projectName: string;
  isOpen: boolean;
  onClose: () => void;
}

export function EmbedBadgeDialog({ projectId, projectName, isOpen, onClose }: EmbedBadgeDialogProps) {
  const [copied, setCopied] = useState<"markdown" | "html" | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isOpen) return null;

  const baseUrl = typeof window !== "undefined" ? window.location.origin : "https://trending.tinix.ai";
  
  // Note: For now, we use the standard shield.io SVG route /api/badge/[id]
  const badgeUrl = `${baseUrl}/api/badge/${projectId}`;
  const targetUrl = `${baseUrl}/project/${projectId}`;

  const markdownCode = `[![TiniX Trending](${badgeUrl})](${targetUrl})`;
  const htmlCode = `<a href="${targetUrl}"><img src="${badgeUrl}" alt="TiniX Trending | ${projectName}" /></a>`;

  const copyToClipboard = async (text: string, type: "markdown" | "html") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      setTimeout(() => setCopied(null), 2000);
    } catch (err) {
      console.error("Failed to copy!", err);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm transition-opacity">
      <div 
        className="bg-[var(--color-bg-primary)] border border-[var(--color-divider-soft)] rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-2">
            <Code2 className="h-5 w-5 text-[var(--color-action-blue)]" />
            <h2 className="text-lg font-bold text-[var(--color-ink)]">Embed Badge</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-md text-[var(--color-ink-muted-80)] hover:bg-[var(--color-canvas)] transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        
        <div className="p-6 flex flex-col gap-6">
          <p className="text-sm text-[var(--color-ink-muted-80)]">
            Showcase your project's achievement on your repository's README or website.
          </p>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-wider">Markdown</label>
              <button 
                onClick={() => copyToClipboard(markdownCode, "markdown")}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-action-blue)] hover:text-blue-500 transition-colors"
              >
                {copied === "markdown" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "markdown" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-3 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg font-mono text-xs text-[var(--color-ink-muted-80)] overflow-x-auto whitespace-pre">
              {markdownCode}
            </div>
          </div>
          
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <label className="text-sm font-bold text-[var(--color-ink)] uppercase tracking-wider">HTML</label>
              <button 
                onClick={() => copyToClipboard(htmlCode, "html")}
                className="flex items-center gap-1.5 text-xs font-semibold text-[var(--color-action-blue)] hover:text-blue-500 transition-colors"
              >
                {copied === "html" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied === "html" ? "Copied!" : "Copy"}
              </button>
            </div>
            <div className="p-3 bg-[var(--color-canvas)] border border-[var(--color-border)] rounded-lg font-mono text-xs text-[var(--color-ink-muted-80)] overflow-x-auto whitespace-pre">
              {htmlCode}
            </div>
          </div>
        </div>
        
        <div className="p-4 border-t border-[var(--color-divider-soft)] bg-[var(--color-bg-secondary)] flex justify-end">
          <button 
            onClick={onClose}
            className="apple-btn-secondary py-2 px-4 text-sm"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
