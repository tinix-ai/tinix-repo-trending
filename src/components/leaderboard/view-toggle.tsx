"use client";

import type { ViewMode } from "@/types";
import { LayoutGrid, Table2, List } from "lucide-react";

interface ViewToggleProps {
  activeView: ViewMode;
  onViewChange: (view: ViewMode) => void;
}

const VIEWS: { value: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { value: "card", label: "Card view", icon: LayoutGrid },
  { value: "table", label: "Table view", icon: Table2 },
  { value: "compact", label: "Compact view", icon: List },
];

export function ViewToggle({ activeView, onViewChange }: ViewToggleProps) {
  return (
    <div className="flex items-center gap-0.5 rounded-lg bg-white/[0.02] border border-white/[0.06] p-0.5">
      {VIEWS.map((view) => (
        <button
          key={view.value}
          onClick={() => onViewChange(view.value)}
          className={`view-toggle-btn ${activeView === view.value ? "active" : ""}`}
          aria-label={view.label}
          aria-pressed={activeView === view.value}
        >
          <view.icon className="h-4 w-4" />
        </button>
      ))}
    </div>
  );
}
