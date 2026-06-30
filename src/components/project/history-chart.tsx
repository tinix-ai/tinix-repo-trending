"use client";

import { useSyncExternalStore } from 'react';
import { 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Area,
  AreaChart
} from 'recharts';

export interface HistoryDataPoint {
  date: string;
  stars?: number;
  forks?: number;
  downloads?: number;
  likes?: number;
}

interface ProjectHistoryChartProps {
  data: HistoryDataPoint[];
  source: 'github' | 'huggingface' | 'paperwithcode' | string;
}

export function ProjectHistoryChart({ data, source }: ProjectHistoryChartProps) {
  const isClient = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  // Determine primary metric based on source
  const isGithub = source === 'github';
  const primaryMetric = isGithub ? 'stars' : 'downloads';
  const primaryColor = isGithub ? '#eab308' : '#3b82f6'; // yellow for stars, blue for downloads
  const secondaryMetric = isGithub ? 'forks' : 'likes';
  const secondaryColor = isGithub ? '#9ca3af' : '#eab308';

  if (!isClient) {
    return (
      <div className="w-full h-full min-h-[180px] bg-[var(--color-bg-secondary)]/50 rounded-xl animate-pulse flex items-center justify-center border border-[var(--color-divider-soft)]">
        <span className="text-xs text-[var(--color-ink-muted-48)]">Loading growth chart...</span>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full min-h-[180px] flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-xl border border-dashed border-[var(--color-divider-soft)]">
        <p className="text-sm text-[var(--color-ink-muted-48)]">No historical data available</p>
      </div>
    );
  }

  // Format Y-axis ticks to handle large numbers (e.g. 15000 -> 15k)
  const formatYAxis = (tickItem: number) => {
    if (tickItem >= 1000000) return `${(tickItem / 1000000).toFixed(1)}M`;
    if (tickItem >= 1000) return `${(tickItem / 1000).toFixed(1)}k`;
    return tickItem.toString();
  };

  // Find min and max to prevent YAxis repeating ticks for identical values
  const values = data.map(d => Number(d[primaryMetric] || 0)).filter(v => !isNaN(v));
  const minVal = values.length > 0 ? Math.min(...values) : 0;
  const maxVal = values.length > 0 ? Math.max(...values) : 100;
  const isConstant = minVal === maxVal;
  
  const yDomain: [string | number, string | number] = isConstant
    ? [Math.max(0, minVal - Math.max(10, Math.floor(minVal * 0.1))), maxVal + Math.max(10, Math.floor(maxVal * 0.1))]
    : ['auto', 'auto'];

  return (
    <div className="w-full h-full font-sans min-h-[180px] min-w-0">
      <ResponsiveContainer width="99%" height={180} minWidth={0} minHeight={0}>
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 5,
            left: -25,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.2}/>
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="4 4" vertical={false} stroke="var(--color-divider-soft)" opacity={0.4} />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted-48)' }}
            dy={8}
            minTickGap={20}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 10, fill: 'var(--color-ink-muted-48)' }}
            tickFormatter={formatYAxis}
            width={40}
            domain={yDomain}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-divider-soft)',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              color: 'var(--color-ink)',
              fontSize: '12px'
            }}
            itemStyle={{
              color: 'var(--color-ink)',
              fontWeight: 500
            }}
          />
          <Area 
            type="monotone" 
            dataKey={primaryMetric} 
            stroke={primaryColor} 
            strokeWidth={2.5}
            fillOpacity={1} 
            fill="url(#colorPrimary)" 
            name={primaryMetric.charAt(0).toUpperCase() + primaryMetric.slice(1)}
            animationDuration={1000}
          />
          <Line 
            type="monotone" 
            dataKey={secondaryMetric} 
            stroke={secondaryColor} 
            strokeWidth={1.5}
            dot={false}
            name={secondaryMetric.charAt(0).toUpperCase() + secondaryMetric.slice(1)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
