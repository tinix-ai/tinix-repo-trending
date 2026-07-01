"use client";

import React from "react";
import { AreaChart, Area, ResponsiveContainer, Tooltip } from "recharts";

interface DBGrowthChartProps {
  data: Array<{ date: string; count: number }>;
}

export function DBGrowthChart({ data }: DBGrowthChartProps) {
  const [isMounted, setIsMounted] = React.useState(false);

  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-16 mt-4 flex items-center justify-center text-[10px] text-[var(--color-ink-muted-48)] font-mono">
        No growth telemetry
      </div>
    );
  }

  if (!isMounted) {
    return <div className="w-full h-16 mt-4" />;
  }

  return (
    <div className="w-full h-16 mt-4 select-none">
      <ResponsiveContainer width="99%" height="100%" minWidth={1} minHeight={1}>
        <AreaChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <defs>
            <linearGradient id="growthGlow" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-action-blue)" stopOpacity={0.15}/>
              <stop offset="95%" stopColor="var(--color-action-blue)" stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <Tooltip
            content={({ active, payload }) => {
              if (active && payload && payload.length) {
                return (
                  <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] px-2.5 py-1 rounded-md text-[10px] font-mono shadow-sm text-[var(--color-ink)]">
                    <span className="font-semibold">{payload[0].payload.date}: </span>
                    <span className="font-bold text-[var(--color-action-blue)]">{payload[0].value} items</span>
                  </div>
                );
              }
              return null;
            }}
            cursor={false}
          />
          <Area 
            type="monotone" 
            dataKey="count" 
            stroke="var(--color-action-blue)" 
            strokeWidth={1.5}
            fillOpacity={1} 
            fill="url(#growthGlow)" 
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
