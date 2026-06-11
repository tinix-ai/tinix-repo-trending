"use client";

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
  // Determine primary metric based on source
  const isGithub = source === 'github';
  const primaryMetric = isGithub ? 'stars' : 'downloads';
  const primaryColor = isGithub ? '#eab308' : '#3b82f6'; // yellow for stars, blue for downloads
  const secondaryMetric = isGithub ? 'forks' : 'likes';
  const secondaryColor = isGithub ? '#9ca3af' : '#eab308';

  if (!data || data.length === 0) {
    return (
      <div className="w-full h-full min-h-[300px] flex items-center justify-center bg-[var(--color-bg-secondary)] rounded-xl border border-dashed border-[var(--color-divider-soft)]">
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

  return (
    <div className="w-full h-full min-h-[300px] font-sans">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{
            top: 10,
            right: 10,
            left: 0,
            bottom: 0,
          }}
        >
          <defs>
            <linearGradient id="colorPrimary" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={primaryColor} stopOpacity={0.3}/>
              <stop offset="95%" stopColor={primaryColor} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-divider-soft)" />
          <XAxis 
            dataKey="date" 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-ink-muted-80)' }}
            dy={10}
            minTickGap={30}
          />
          <YAxis 
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 12, fill: 'var(--color-ink-muted-80)' }}
            tickFormatter={formatYAxis}
            width={40}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--color-surface-elevated)',
              borderColor: 'var(--color-divider-soft)',
              borderRadius: '12px',
              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
              color: 'var(--color-ink)'
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
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#colorPrimary)" 
            name={primaryMetric.charAt(0).toUpperCase() + primaryMetric.slice(1)}
            animationDuration={1000}
          />
          <Line 
            type="monotone" 
            dataKey={secondaryMetric} 
            stroke={secondaryColor} 
            strokeWidth={2}
            dot={false}
            name={secondaryMetric.charAt(0).toUpperCase() + secondaryMetric.slice(1)}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
