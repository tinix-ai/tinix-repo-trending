'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
import {
  BarChart2, Link2, TrendingUp, Globe, Monitor, Smartphone,
  MousePointerClick, RefreshCw, ArrowUpRight, ArrowDownRight,
  Users, Activity, Clock, Download, Share2, ChevronRight,
  Twitter, Linkedin, Hash, Zap, Calendar, Map, ExternalLink,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Summary {
  totalClicks: number;
  humanClicks: number;
  botClicks: number;
  uniqueVisitors: number;
  activeDays: number;
  clicksChange: number | null;
  prevClicks: number;
}

interface DailyClick { day: string; clicks: number; unique_visitors: number }
interface HeatmapCell { dow: number; hour: number; clicks: number }
interface TrafficSource { platform: string; clicks: number; unique_visitors: number; percentage: number }
interface CountryRow { country: string; clicks: number; unique_visitors: number; percentage: number }
interface DeviceRow { device: string; clicks: number; human_clicks: number; percentage: number }
interface TopLink { code: string; created_at: string; project_full_name: string; source: string; stars: number; likes: number; clicks: number; unique_visitors: number }
interface DowRow { dow: number; clicks: number }
interface VisitorType { visitor_type: string; visitors: number }

interface FullStats {
  summary: Summary;
  dailyClicks: DailyClick[];
  hourlyHeatmap: HeatmapCell[];
  trafficSources: TrafficSource[];
  countryBreakdown: CountryRow[];
  deviceBreakdown: DeviceRow[];
  topLinks: TopLink[];
  peakHours: { hour: number; clicks: number }[];
  visitorType: VisitorType[];
  utmSources: { utm_source: string; clicks: number }[];
  clicksByDow: DowRow[];
}

interface LinkRow { code: string; projectFullName: string; projectId: string; createdAt: string; totalClicks: number }

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const PALETTE = ['#6366f1', '#8b5cf6', '#a78bfa', '#f59e0b', '#10b981', '#06b6d4', '#f43f5e', '#84cc16'];
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const PLATFORM_ICONS: Record<string, React.ReactNode> = {
  'X / Twitter': <Twitter size={13} />,
  'LinkedIn': <Linkedin size={13} />,
  'Reddit': <Hash size={13} />,
  'Direct': <Zap size={13} />,
  'Hacker News': <Activity size={13} />,
};

const TABS = [
  { id: 'overview',  label: 'Overview',         icon: BarChart2 },
  { id: 'traffic',   label: 'Traffic Sources',  icon: Share2 },
  { id: 'geo',       label: 'Geographic',       icon: Globe },
  { id: 'devices',   label: 'Devices',          icon: Monitor },
  { id: 'links',     label: 'Top Links',        icon: Link2 },
  { id: 'behavior',  label: 'Behavior',         icon: Clock },
];

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function pct(a: number, total: number): string {
  if (!total) return '0%';
  return (a / total * 100).toFixed(1) + '%';
}

function heatColor(val: number, max: number): string {
  if (!val) return 'rgba(99,102,241,0.04)';
  const ratio = val / max;
  if (ratio < 0.2) return 'rgba(99,102,241,0.15)';
  if (ratio < 0.4) return 'rgba(99,102,241,0.35)';
  if (ratio < 0.6) return 'rgba(99,102,241,0.55)';
  if (ratio < 0.8) return 'rgba(99,102,241,0.75)';
  return 'rgba(99,102,241,0.95)';
}

function downloadCSV(data: Record<string, unknown>[], filename: string) {
  if (!data.length) return;
  const headers = Object.keys(data[0]);
  const rows = data.map(row => headers.map(h => JSON.stringify(row[h] ?? '')).join(','));
  const csv = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div className="apple-utility-card" style={style}>
      {children}
    </div>
  );
}

function CardHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="px-5 py-4 border-b border-[var(--color-divider-soft)] flex justify-between items-center">
      <span className="text-[13px] font-semibold text-[var(--color-ink-muted-80)]">{title}</span>
      {action}
    </div>
  );
}

function MetricCard({
  icon: Icon, label, value, sub, change, color = '#6366f1',
}: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; change?: number | null; color?: string;
}) {
  const positive = (change ?? 0) >= 0;
  return (
    <Card style={{ padding: '20px 22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ background: `${color}22`, border: `1px solid ${color}44`, borderRadius: '8px', padding: '8px', display: 'flex' }}>
          <Icon size={15} color={color} />
        </div>
        {change !== undefined && change !== null && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', fontSize: '11px', fontWeight: '600', color: positive ? '#10b981' : '#f43f5e' }}>
            {positive ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div style={{ marginTop: '12px', fontSize: '26px', fontWeight: '700', color: 'var(--color-ink)', lineHeight: 1 }}>{value}</div>
      <div style={{ marginTop: '4px', fontSize: '12px', color: 'var(--color-ink-muted-48)' }}>{label}</div>
      {sub && <div style={{ marginTop: '4px', fontSize: '11px', color: 'var(--color-ink-muted-24)' }}>{sub}</div>}
    </Card>
  );
}

function ProgressBar({ value, max, color = '#6366f1' }: { value: number; max: number; color?: string }) {
  const w = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ height: '4px', borderRadius: '2px', background: 'var(--color-surface-tile-1)', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${w}%`, background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
    </div>
  );
}

const TOOLTIP_STYLE = {
  contentStyle: { background: 'var(--color-surface-elevated)', border: '1px solid var(--color-hairline)', borderRadius: '8px', fontSize: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.1)' },
  labelStyle: { color: 'var(--color-ink)', fontWeight: '600', marginBottom: '4px' },
  itemStyle: { color: 'var(--color-action-blue)' },
};

// ─────────────────────────────────────────────
// Tab: Overview
// ─────────────────────────────────────────────
function OverviewTab({ stats, days }: { stats: FullStats; days: number }) {
  const daily = useMemo(() =>
    stats.dailyClicks.map(d => ({
      date: new Date(d.day).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      clicks: d.clicks,
      visitors: d.unique_visitors,
    })), [stats.dailyClicks]);

  const dowData = useMemo(() => {
    const map: Record<number, number> = {};
    stats.clicksByDow.forEach(d => { map[d.dow] = d.clicks; });
    return DOW_LABELS.map((label, i) => ({ label, clicks: map[i] ?? 0 }));
  }, [stats.clicksByDow]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Traffic Over Time */}
      <Card>
        <CardHeader title={`Traffic Over Time (${days}d)`} />
        <div style={{ padding: '20px' }}>
          {daily.length === 0 ? (
            <EmptyState label="No traffic data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
              <AreaChart data={daily} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="clickGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="visitorGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Legend wrapperStyle={{ fontSize: '12px', color: 'var(--color-ink-muted-24)' }} />
                <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#6366f1" strokeWidth={2} fill="url(#clickGrad)" dot={false} activeDot={{ r: 4 }} />
                <Area type="monotone" dataKey="visitors" name="Unique Visitors" stroke="#10b981" strokeWidth={2} fill="url(#visitorGrad)" dot={false} activeDot={{ r: 4 }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Day-of-week pattern */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card>
          <CardHeader title="Clicks by Day of Week" />
          <div style={{ padding: '20px' }}>
            <ResponsiveContainer width="100%" height={160} minWidth={0} minHeight={0}>
              <BarChart data={dowData} margin={{ top: 0, right: 0, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* New vs Returning */}
        <Card>
          <CardHeader title="New vs Returning Visitors" />
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
            {stats.visitorType.length === 0 ? (
              <EmptyState label="No visitor data" />
            ) : (
              <>
                <ResponsiveContainer width={120} height={120} minWidth={0} minHeight={0}>
                  <PieChart>
                    <Pie data={stats.visitorType} dataKey="visitors" nameKey="visitor_type" cx="50%" cy="50%" innerRadius={32} outerRadius={52} strokeWidth={0}>
                      {stats.visitorType.map((_, i) => (
                        <Cell key={i} fill={PALETTE[i]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ ...TOOLTIP_STYLE.contentStyle }} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ flex: 1 }}>
                  {stats.visitorType.map((v, i) => {
                    const total = stats.visitorType.reduce((s, x) => s + x.visitors, 0);
                    return (
                      <div key={v.visitor_type} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: PALETTE[i] }} />
                            <span style={{ fontSize: '12px', color: 'var(--color-ink-muted-64)', textTransform: 'capitalize' }}>{v.visitor_type}</span>
                          </div>
                          <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-ink)' }}>{pct(v.visitors, total)}</span>
                        </div>
                        <ProgressBar value={v.visitors} max={total} color={PALETTE[i]} />
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Traffic Sources
// ─────────────────────────────────────────────
function TrafficTab({ stats }: { stats: FullStats }) {
  const maxClicks = Math.max(...stats.trafficSources.map(s => s.clicks), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Chart */}
      <Card>
        <CardHeader
          title="Traffic by Platform"
          action={
            <button onClick={() => downloadCSV(stats.trafficSources as unknown as Record<string, unknown>[], 'traffic-sources.csv')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-divider-soft)', borderRadius: '6px', color: 'var(--color-ink-muted-24)', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>
              <Download size={11} /> Export
            </button>
          }
        />
        <div style={{ padding: '20px' }}>
          <ResponsiveContainer width="100%" height={220} minWidth={0} minHeight={0}>
            <BarChart data={stats.trafficSources} layout="vertical" margin={{ top: 0, right: 40, left: 80, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
              <YAxis type="category" dataKey="platform" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} width={80} />
              <Tooltip {...TOOLTIP_STYLE} />
              <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[0, 3, 3, 0]}>
                {stats.trafficSources.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* Detailed Table */}
      <Card>
        <CardHeader title="Source Details" />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
                {['Platform', 'Clicks', 'Unique Visitors', 'Share', 'Distribution'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--color-ink-muted-48)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.trafficSources.length === 0 && (
                <tr><td colSpan={5} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted-24)', fontSize: '13px' }}>No traffic data</td></tr>
              )}
              {stats.trafficSources.map((s, i) => (
                <tr key={s.platform} style={{ borderBottom: '1px solid var(--color-divider-soft)', transition: 'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'var(--color-ink-muted-24)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ color: PALETTE[i % PALETTE.length] }}>{PLATFORM_ICONS[s.platform] ?? <Share2 size={13} />}</div>
                      <span style={{ fontSize: '13px', color: 'var(--color-ink-muted-80)', fontWeight: '500' }}>{s.platform}</span>
                    </div>
                  </td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--color-ink)' }}>{s.clicks.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-ink-muted-64)' }}>{s.unique_visitors.toLocaleString()}</td>
                  <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-ink-muted-64)' }}>{s.percentage}%</td>
                  <td style={{ padding: '12px 16px', width: '140px' }}>
                    <ProgressBar value={s.clicks} max={maxClicks} color={PALETTE[i % PALETTE.length]} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Geographic
// ─────────────────────────────────────────────
function GeoTab({ stats }: { stats: FullStats }) {
  const maxClicks = Math.max(...stats.countryBreakdown.map(c => c.clicks), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Pie + Bar */}
      <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '20px' }}>
        <Card>
          <CardHeader title="Top Countries" />
          <div style={{ padding: '16px' }}>
            <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={stats.countryBreakdown.slice(0, 6)} dataKey="clicks" nameKey="country" cx="50%" cy="50%" innerRadius={40} outerRadius={80} strokeWidth={0}>
                  {stats.countryBreakdown.slice(0, 6).map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ ...TOOLTIP_STYLE.contentStyle }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>
        <Card>
          <CardHeader title="Distribution by Country" />
          <div style={{ padding: '20px' }}>
            <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
              <BarChart data={stats.countryBreakdown.slice(0, 10)} layout="vertical" margin={{ top: 0, right: 40, left: 60, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="country" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} width={60} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" name="Clicks" fill="#6366f1" radius={[0, 3, 3, 0]}>
                  {stats.countryBreakdown.slice(0, 10).map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Detailed table */}
      <Card>
        <CardHeader
          title="All Countries"
          action={
            <button onClick={() => downloadCSV(stats.countryBreakdown as unknown as Record<string, unknown>[], 'countries.csv')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-divider-soft)', borderRadius: '6px', color: 'var(--color-ink-muted-24)', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>
              <Download size={11} /> Export
            </button>
          }
        />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
                {['#', 'Country', 'Clicks', 'Unique Visitors', 'Share', ''].map((h, i) => (
                  <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--color-ink-muted-48)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.countryBreakdown.length === 0 && (
                <tr><td colSpan={6} style={{ padding: '24px', textAlign: 'center', color: 'var(--color-ink-muted-24)', fontSize: '13px' }}>No geo data available</td></tr>
              )}
              {stats.countryBreakdown.map((c, i) => (
                <tr key={c.country} style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
                  <td style={{ padding: '10px 16px', fontSize: '12px', color: 'var(--color-ink-muted-24)', width: 40 }}>{i + 1}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {c.country !== 'Unknown' && (
                        <img src={`https://flagcdn.com/w20/${c.country.toLowerCase()}.png`} alt="" style={{ width: 18, height: 13, objectFit: 'cover', borderRadius: '2px' }} onError={e => (e.currentTarget.style.display = 'none')} />
                      )}
                      <span style={{ fontSize: '13px', color: 'var(--color-ink-muted-80)' }}>{c.country}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', fontWeight: '600', color: 'var(--color-ink)' }}>{c.clicks.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-ink-muted-64)' }}>{c.unique_visitors.toLocaleString()}</td>
                  <td style={{ padding: '10px 16px', fontSize: '13px', color: 'var(--color-ink-muted-64)' }}>{c.percentage}%</td>
                  <td style={{ padding: '10px 16px', width: 120 }}><ProgressBar value={c.clicks} max={maxClicks} color={PALETTE[i % PALETTE.length]} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Devices
// ─────────────────────────────────────────────
function DevicesTab({ stats }: { stats: FullStats }) {
  const deviceColors: Record<string, string> = { desktop: '#6366f1', mobile: '#f59e0b', bot: '#64748b', unknown: '#374151' };
  const human = stats.deviceBreakdown.filter(d => d.device !== 'bot');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card>
          <CardHeader title="Device Split (Human Traffic)" />
          <div style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '24px' }}>
            <ResponsiveContainer width={140} height={140} minWidth={0} minHeight={0}>
              <PieChart>
                <Pie data={human} dataKey="human_clicks" nameKey="device" cx="50%" cy="50%" innerRadius={40} outerRadius={62} strokeWidth={0}>
                  {human.map((d) => <Cell key={d.device} fill={deviceColors[d.device] ?? '#6366f1'} />)}
                </Pie>
                <Tooltip contentStyle={{ ...TOOLTIP_STYLE.contentStyle }} />
              </PieChart>
            </ResponsiveContainer>
            <div style={{ flex: 1 }}>
              {human.map(d => {
                const total = human.reduce((s, x) => s + x.human_clicks, 0);
                const Icon = d.device === 'mobile' ? Smartphone : Monitor;
                return (
                  <div key={d.device} style={{ marginBottom: '14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '5px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Icon size={13} color={deviceColors[d.device] ?? '#6366f1'} />
                        <span style={{ fontSize: '12px', color: 'var(--color-ink-muted-64)', textTransform: 'capitalize' }}>{d.device}</span>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-ink)' }}>{d.human_clicks.toLocaleString()}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-ink-muted-48)' }}>{pct(d.human_clicks, total)}</span>
                      </div>
                    </div>
                    <ProgressBar value={d.human_clicks} max={total} color={deviceColors[d.device] ?? '#6366f1'} />
                  </div>
                );
              })}
            </div>
          </div>
        </Card>

        <Card>
          <CardHeader title="All Traffic (incl. Bots)" />
          <div style={{ padding: '20px' }}>
            <ResponsiveContainer width="100%" height={200} minWidth={0} minHeight={0}>
              <BarChart data={stats.deviceBreakdown} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-divider-soft)" vertical={false} />
                <XAxis dataKey="device" tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-ink-muted-48)' }} axisLine={false} tickLine={false} />
                <Tooltip {...TOOLTIP_STYLE} />
                <Bar dataKey="clicks" name="Total Clicks" radius={[3, 3, 0, 0]}>
                  {stats.deviceBreakdown.map(d => <Cell key={d.device} fill={deviceColors[d.device] ?? '#6366f1'} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Top Links
// ─────────────────────────────────────────────
function TopLinksTab({ stats }: { stats: FullStats }) {
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://trending.tinix.ai';

  return (
    <Card>
      <CardHeader
        title="Top Performing Links"
        action={
          <button onClick={() => downloadCSV(stats.topLinks as unknown as Record<string, unknown>[], 'top-links.csv')} style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: '1px solid var(--color-divider-soft)', borderRadius: '6px', color: 'var(--color-ink-muted-24)', padding: '4px 10px', cursor: 'pointer', fontSize: '11px' }}>
            <Download size={11} /> Export CSV
          </button>
        }
      />
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
              {['#', 'Project', 'Short URL', 'Clicks', 'Unique Visitors', 'Created', ''].map((h, i) => (
                <th key={i} style={{ padding: '10px 16px', textAlign: 'left', fontSize: '11px', color: 'var(--color-ink-muted-48)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.topLinks.length === 0 && (
              <tr><td colSpan={7} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-ink-muted-24)', fontSize: '13px' }}>No links created yet</td></tr>
            )}
            {stats.topLinks.map((l, i) => (
              <tr key={l.code} style={{ borderBottom: '1px solid var(--color-divider-soft)' }}>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-ink-muted-24)', width: 36 }}>{i + 1}</td>
                <td style={{ padding: '12px 16px', maxWidth: '200px' }}>
                  <div style={{ fontSize: '13px', fontWeight: '500', color: 'var(--color-ink-muted-80)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.project_full_name}</div>
                  <div style={{ fontSize: '11px', color: 'var(--color-ink-muted-48)', marginTop: '2px', textTransform: 'capitalize' }}>{l.source}</div>
                </td>
                <td style={{ padding: '12px 16px' }}>
                  <a href={`${baseUrl}/s/${l.code}`} target="_blank" rel="noreferrer" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: '#a5b4fc', fontFamily: 'monospace', textDecoration: 'none' }}>
                    /s/{l.code} <ExternalLink size={10} />
                  </a>
                </td>
                <td style={{ padding: '12px 16px', fontSize: '14px', fontWeight: '700', color: 'var(--color-ink)' }}>{l.clicks.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: '13px', color: 'var(--color-ink-muted-64)' }}>{l.unique_visitors.toLocaleString()}</td>
                <td style={{ padding: '12px 16px', fontSize: '12px', color: 'var(--color-ink-muted-48)' }}>{new Date(l.created_at).toLocaleDateString()}</td>
                <td style={{ padding: '12px 16px' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[5, 4, 3, 2, 1, 0].map(level => (
                      <div key={level} style={{ width: 6, height: 6, borderRadius: '50%', background: l.clicks > level * 5 ? '#6366f1' : 'var(--color-ink-muted-24)' }} />
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ─────────────────────────────────────────────
// Tab: Behavior (Heatmap + Peak hours)
// ─────────────────────────────────────────────
function BehaviorTab({ stats }: { stats: FullStats }) {
  const heatmap = useMemo(() => {
    const map: Record<string, number> = {};
    stats.hourlyHeatmap.forEach(c => { map[`${c.dow}-${c.hour}`] = c.clicks; });
    return map;
  }, [stats.hourlyHeatmap]);

  const maxHeat = Math.max(...stats.hourlyHeatmap.map(c => c.clicks), 1);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* Heatmap */}
      <Card>
        <CardHeader title="Activity Heatmap — Day × Hour (UTC)" />
        <div style={{ padding: '20px', overflowX: 'auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '44px repeat(24, 1fr)', gap: '3px', minWidth: '600px' }}>
            {/* Header row */}
            <div />
            {Array.from({ length: 24 }, (_, h) => (
              <div key={h} style={{ fontSize: '9px', color: 'var(--color-ink-muted-24)', textAlign: 'center', paddingBottom: '4px' }}>
                {h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`}
              </div>
            ))}
            {/* Data rows */}
            {DOW_LABELS.map((day, dow) => (
              <React.Fragment key={dow}>
                <div style={{ fontSize: '10px', color: 'var(--color-ink-muted-48)', display: 'flex', alignItems: 'center', paddingRight: '6px', justifyContent: 'flex-end' }}>
                  {day}
                </div>
                {Array.from({ length: 24 }, (_, h) => {
                  const val = heatmap[`${dow}-${h}`] ?? 0;
                  return (
                    <div
                      key={h}
                      title={`${day} ${h}:00 — ${val} clicks`}
                      style={{
                        height: '18px',
                        borderRadius: '3px',
                        background: heatColor(val, maxHeat),
                        cursor: val > 0 ? 'pointer' : 'default',
                        transition: 'transform 0.1s',
                      }}
                      onMouseEnter={e => val > 0 && ((e.currentTarget as HTMLElement).style.transform = 'scale(1.3)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.transform = 'scale(1)')}
                    />
                  );
                })}
              </React.Fragment>
            ))}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '14px', justifyContent: 'flex-end' }}>
            <span style={{ fontSize: '10px', color: 'var(--color-ink-muted-24)' }}>Less</span>
            {[0.04, 0.15, 0.35, 0.55, 0.75, 0.95].map((o, i) => (
              <div key={i} style={{ width: 12, height: 12, borderRadius: '2px', background: `rgba(99,102,241,${o})` }} />
            ))}
            <span style={{ fontSize: '10px', color: 'var(--color-ink-muted-24)' }}>More</span>
          </div>
        </div>
      </Card>

      {/* Peak hours */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <Card>
          <CardHeader title="Peak Hours" />
          <div style={{ padding: '16px 20px' }}>
            {stats.peakHours.length === 0 ? (
              <EmptyState label="No data" />
            ) : stats.peakHours.map((h, i) => (
              <div key={h.hour} style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
                <div style={{ width: 36, height: 36, borderRadius: '8px', background: `rgba(99,102,241,${0.8 - i * 0.12})`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', color: 'var(--color-ink)', flexShrink: 0 }}>
                  {h.hour}:00
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-muted-64)' }}>
                      {h.hour < 12 ? `${h.hour === 0 ? 12 : h.hour} AM` : `${h.hour === 12 ? 12 : h.hour - 12} PM`}
                    </span>
                    <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-ink)' }}>{h.clicks} clicks</span>
                  </div>
                  <ProgressBar value={h.clicks} max={stats.peakHours[0]?.clicks ?? 1} color="#6366f1" />
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <CardHeader title="UTM Source Breakdown" />
          <div style={{ padding: '16px 20px' }}>
            {stats.utmSources.length === 0 ? (
              <EmptyState label="No UTM data" />
            ) : stats.utmSources.map((u, i) => {
              const total = stats.utmSources.reduce((s, x) => s + x.clicks, 0);
              return (
                <div key={u.utm_source} style={{ marginBottom: '12px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ fontSize: '12px', color: 'var(--color-ink-muted-64)', textTransform: 'capitalize' }}>{u.utm_source}</span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <span style={{ fontSize: '12px', fontWeight: '600', color: 'var(--color-ink)' }}>{u.clicks}</span>
                      <span style={{ fontSize: '11px', color: 'var(--color-ink-muted-48)' }}>{pct(u.clicks, total)}</span>
                    </div>
                  </div>
                  <ProgressBar value={u.clicks} max={total} color={PALETTE[i % PALETTE.length]} />
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="p-8 text-center text-[13px] text-[var(--color-ink-muted-48)]">
      {label}
    </div>
  );
}

// ─────────────────────────────────────────────
// Main Dashboard
// ─────────────────────────────────────────────
export default function ShareAnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<FullStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/share/stats?days=${days}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setLastUpdated(new Date());
      }
    } finally {
      setLoading(false);
    }
  }, [days]);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadStats(); }, [loadStats]);

  const summary = stats?.summary;
  const clicksChange = summary?.clicksChange ?? null;

  return (
    <div className="w-full">
      <div className="mt-6 md:mt-10 mb-8">
        <h1 className="text-3xl md:text-[32px] font-bold tracking-tight text-[var(--color-ink)] leading-tight flex items-center gap-3">
          <BarChart2 className="text-[var(--color-action-blue)]" size={32} />
          Share Links Analytics
        </h1>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2">
            {lastUpdated && <span className="text-[11px] text-[var(--color-ink-muted-48)]">Updated {lastUpdated.toLocaleTimeString()}</span>}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="flex gap-0.5 p-0.5 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] rounded-lg">
            {[7, 14, 30, 90].map(d => (
              <button
                key={d}
                onClick={() => setDays(d)}
                className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                  days === d
                    ? "bg-[var(--color-canvas)] text-[var(--color-ink)] shadow-sm"
                    : "text-[var(--color-ink-muted-48)] hover:text-[var(--color-ink)]"
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <button
            onClick={loadStats}
            disabled={loading}
            className="flex items-center gap-1.5 px-3.5 py-1.5 bg-[var(--color-bg-secondary)] border border-[var(--color-divider-soft)] text-[var(--color-ink)] rounded-full text-[12px] font-medium hover:bg-[var(--color-bg-secondary)]/80 transition-colors focus:outline-none cursor-pointer"
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Metric Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-4">
        <MetricCard icon={MousePointerClick} label={`Clicks (${days}d)`} value={fmt(summary?.humanClicks ?? 0)} change={clicksChange} color="#6366f1" sub={`vs ${fmt(summary?.prevClicks ?? 0)} prev period`} />
        <MetricCard icon={Users} label="Unique Visitors" value={fmt(summary?.uniqueVisitors ?? 0)} color="#10b981" />
        <MetricCard icon={Link2} label="Total Links" value={stats?.topLinks?.length ?? 0} color="#f59e0b" />
        <MetricCard icon={Activity} label="Active Days" value={summary?.activeDays ?? 0} color="#06b6d4" sub={`in last ${days} days`} />
        <MetricCard icon={Zap} label="Bot Traffic" value={fmt(summary?.botClicks ?? 0)} color="#64748b" sub="filtered from stats" />
      </div>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 border-b border-[var(--color-divider-soft)]">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2 border-b-2 text-[13px] font-medium transition-all cursor-pointer ${
                active
                  ? "border-[var(--color-action-blue)] text-[var(--color-action-blue)]"
                  : "border-transparent text-[var(--color-ink-muted-64)] hover:text-[var(--color-ink)]"
              }`}
            >
              <Icon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <div className="w-full">
        <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        {loading ? (
          <div className="flex items-center justify-center h-[300px] gap-3 text-[var(--color-ink-muted-48)] text-sm">
            <RefreshCw size={18} className="animate-spin" />
            Loading analytics…
          </div>
        ) : !stats ? (
          <EmptyState label="Failed to load data. Please refresh." />
        ) : (
          <>
            {activeTab === 'overview'  && <OverviewTab  stats={stats} days={days} />}
            {activeTab === 'traffic'   && <TrafficTab   stats={stats} />}
            {activeTab === 'geo'       && <GeoTab       stats={stats} />}
            {activeTab === 'devices'   && <DevicesTab   stats={stats} />}
            {activeTab === 'links'     && <TopLinksTab  stats={stats} />}
            {activeTab === 'behavior'  && <BehaviorTab  stats={stats} />}
          </>
        )}
      </div>
    </div>
  );
}
