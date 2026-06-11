"use client";

import type { RankingPeriod } from "@/types";

interface PeriodTabsProps {
  activePeriod: RankingPeriod;
  onPeriodChange: (period: RankingPeriod) => void;
}

const PERIODS: { value: RankingPeriod; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
];

export function PeriodTabs({ activePeriod, onPeriodChange }: PeriodTabsProps) {
  return (
    <div className="flex items-center gap-1 rounded-xl bg-white/[0.02] border border-white/[0.06] p-1">
      {PERIODS.map((period) => (
        <button
          key={period.value}
          onClick={() => onPeriodChange(period.value)}
          className={`period-tab ${activePeriod === period.value ? "active" : ""}`}
        >
          {period.label}
        </button>
      ))}
    </div>
  );
}
