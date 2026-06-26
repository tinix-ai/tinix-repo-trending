import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shareLinks, shareEvents } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');       // specific link, or omit for global
    const projectId = searchParams.get('projectId');
    const days = Math.min(parseInt(searchParams.get('days') || '30', 10), 365);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    let targetCode = code;
    if (!targetCode && projectId) {
      const [link] = await db
        .select({ code: shareLinks.code })
        .from(shareLinks)
        .where(eq(shareLinks.projectId, projectId))
        .limit(1);
      if (!link) return NextResponse.json(buildEmpty());
      targetCode = link.code;
    }

    const codeFilter = targetCode
      ? sql`AND link_code = ${targetCode}`
      : sql`AND 1=1`;

    // ── 1. Summary totals ────────────────────────────────────────────────────
    const [totals] = await db.execute(sql`
      SELECT
        COUNT(*)::int                                          AS total_clicks,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int     AS human_clicks,
        COUNT(*) FILTER (WHERE device_type = 'bot')::int      AS bot_clicks,
        COUNT(DISTINCT ip_hash)                                AS unique_visitors,
        COUNT(DISTINCT DATE(clicked_at))                       AS active_days
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
    `) as { total_clicks: number; human_clicks: number; bot_clicks: number; unique_visitors: number; active_days: number }[];

    // ── 2. Comparison: previous period ───────────────────────────────────────
    const prevSince = new Date(since.getTime() - days * 24 * 60 * 60 * 1000);
    const [prevTotals] = await db.execute(sql`
      SELECT COUNT(*) FILTER (WHERE device_type != 'bot')::int AS human_clicks
      FROM share_events
      WHERE clicked_at >= ${prevSince} AND clicked_at < ${since}
      ${codeFilter}
    `) as { human_clicks: number }[];

    // ── 3. Daily clicks ───────────────────────────────────────────────────────
    const dailyClicks = await db.execute(sql`
      SELECT
        DATE(clicked_at AT TIME ZONE 'UTC') AS day,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks,
        COUNT(DISTINCT ip_hash) AS unique_visitors
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY day
      ORDER BY day ASC
    `);

    // ── 4. Hourly heatmap (0-23 UTC) ─────────────────────────────────────────
    const hourlyHeatmap = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM clicked_at)::int  AS dow,
        EXTRACT(HOUR FROM clicked_at)::int AS hour,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY dow, hour
      ORDER BY dow, hour
    `);

    // ── 5. Traffic sources (detailed) ────────────────────────────────────────
    const trafficSources = await db.execute(sql`
      SELECT
        CASE
          WHEN referrer LIKE '%twitter.com%' OR referrer LIKE '%t.co/%' OR referrer LIKE '%x.com%' THEN 'X / Twitter'
          WHEN referrer LIKE '%linkedin.com%' THEN 'LinkedIn'
          WHEN referrer LIKE '%facebook.com%' OR referrer LIKE '%fb.com%' THEN 'Facebook'
          WHEN referrer LIKE '%reddit.com%' THEN 'Reddit'
          WHEN referrer LIKE '%news.ycombinator.com%' OR referrer LIKE '%hackernews%' THEN 'Hacker News'
          WHEN referrer LIKE '%github.com%' THEN 'GitHub'
          WHEN referrer LIKE '%discord.com%' OR referrer LIKE '%discord.gg%' THEN 'Discord'
          WHEN referrer LIKE '%telegram%' OR referrer LIKE '%t.me%' THEN 'Telegram'
          WHEN referrer LIKE '%whatsapp%' THEN 'WhatsApp'
          WHEN referrer LIKE '%medium.com%' THEN 'Medium'
          WHEN referrer LIKE '%dev.to%' THEN 'Dev.to'
          WHEN referrer LIKE '%youtube.com%' OR referrer LIKE '%youtu.be%' THEN 'YouTube'
          WHEN referrer IS NULL OR referrer = '' THEN 'Direct'
          ELSE 'Other'
        END AS platform,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks,
        COUNT(DISTINCT ip_hash) AS unique_visitors,
        ROUND(
          COUNT(*) FILTER (WHERE device_type != 'bot') * 100.0 /
          NULLIF(SUM(COUNT(*) FILTER (WHERE device_type != 'bot')) OVER (), 0), 1
        )::float AS percentage
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY platform
      ORDER BY clicks DESC
    `);

    // ── 6. Country breakdown ─────────────────────────────────────────────────
    const countryBreakdown = await db.execute(sql`
      SELECT
        COALESCE(NULLIF(country, ''), 'Unknown') AS country,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks,
        COUNT(DISTINCT ip_hash) AS unique_visitors,
        ROUND(
          COUNT(*) FILTER (WHERE device_type != 'bot') * 100.0 /
          NULLIF(SUM(COUNT(*) FILTER (WHERE device_type != 'bot')) OVER (), 0), 1
        )::float AS percentage
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY country
      ORDER BY clicks DESC
      LIMIT 20
    `);

    // ── 7. Device breakdown ──────────────────────────────────────────────────
    const deviceBreakdown = await db.execute(sql`
      SELECT
        COALESCE(device_type, 'unknown') AS device,
        COUNT(*)::int AS clicks,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS human_clicks,
        ROUND(
          COUNT(*) * 100.0 / NULLIF(SUM(COUNT(*)) OVER (), 0), 1
        )::float AS percentage
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY device_type
      ORDER BY clicks DESC
    `);

    // ── 8. Top links (global or filtered) ────────────────────────────────────
    const topLinks = await db.execute(sql`
      SELECT
        sl.code,
        sl.created_at,
        p.full_name AS project_full_name,
        p.source,
        p.stars,
        p.likes,
        COUNT(se.id) FILTER (WHERE se.device_type != 'bot')::int AS clicks,
        COUNT(DISTINCT se.ip_hash) AS unique_visitors
      FROM share_links sl
      JOIN projects p ON p.id = sl.project_id
      LEFT JOIN share_events se ON se.link_code = sl.code AND se.clicked_at >= ${since}
      GROUP BY sl.code, sl.created_at, p.full_name, p.source, p.stars, p.likes
      ORDER BY clicks DESC
      LIMIT 20
    `);

    // ── 9. Peak hours (top 5 hours by clicks) ────────────────────────────────
    const peakHours = await db.execute(sql`
      SELECT
        EXTRACT(HOUR FROM clicked_at)::int AS hour,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY hour
      ORDER BY clicks DESC
      LIMIT 5
    `);

    // ── 10. New vs returning visitors ─────────────────────────────────────────
    const visitorType = await db.execute(sql`
      WITH first_visits AS (
        SELECT ip_hash, MIN(clicked_at) AS first_click
        FROM share_events
        WHERE device_type != 'bot' AND ip_hash IS NOT NULL
        GROUP BY ip_hash
      )
      SELECT
        CASE WHEN fv.first_click >= ${since} THEN 'new' ELSE 'returning' END AS visitor_type,
        COUNT(DISTINCT se.ip_hash)::int AS visitors
      FROM share_events se
      JOIN first_visits fv ON fv.ip_hash = se.ip_hash
      WHERE se.clicked_at >= ${since}
        AND se.device_type != 'bot'
      ${codeFilter}
      GROUP BY visitor_type
    `);

    // ── 11. UTM source breakdown ──────────────────────────────────────────────
    const utmSources = await db.execute(sql`
      SELECT
        COALESCE(sl.utm_source, 'unknown') AS utm_source,
        COUNT(se.id) FILTER (WHERE se.device_type != 'bot')::int AS clicks
      FROM share_events se
      JOIN share_links sl ON sl.code = se.link_code
      WHERE se.clicked_at >= ${since}
      ${codeFilter}
      GROUP BY sl.utm_source
      ORDER BY clicks DESC
    `);

    // ── 12. Clicks by day-of-week ─────────────────────────────────────────────
    const clicksByDow = await db.execute(sql`
      SELECT
        EXTRACT(DOW FROM clicked_at)::int AS dow,
        COUNT(*) FILTER (WHERE device_type != 'bot')::int AS clicks
      FROM share_events
      WHERE clicked_at >= ${since}
      ${codeFilter}
      GROUP BY dow
      ORDER BY dow
    `);

    const currentClicks = Number(totals?.human_clicks ?? 0);
    const prevClicks = Number(prevTotals?.human_clicks ?? 0);
    const clicksChange = prevClicks > 0
      ? Math.round(((currentClicks - prevClicks) / prevClicks) * 100)
      : null;

    return NextResponse.json({
      summary: {
        totalClicks: Number(totals?.total_clicks ?? 0),
        humanClicks: currentClicks,
        botClicks: Number(totals?.bot_clicks ?? 0),
        uniqueVisitors: Number(totals?.unique_visitors ?? 0),
        activeDays: Number(totals?.active_days ?? 0),
        clicksChange,
        prevClicks,
      },
      dailyClicks: dailyClicks as unknown[],
      hourlyHeatmap: hourlyHeatmap as unknown[],
      trafficSources: trafficSources as unknown[],
      countryBreakdown: countryBreakdown as unknown[],
      deviceBreakdown: deviceBreakdown as unknown[],
      topLinks: topLinks as unknown[],
      peakHours: peakHours as unknown[],
      visitorType: visitorType as unknown[],
      utmSources: utmSources as unknown[],
      clicksByDow: clicksByDow as unknown[],
      meta: { code: targetCode, days, since: since.toISOString() },
    });
  } catch (err) {
    console.error('[ShareLink] Stats error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

function buildEmpty() {
  return {
    summary: { totalClicks: 0, humanClicks: 0, botClicks: 0, uniqueVisitors: 0, activeDays: 0, clicksChange: null, prevClicks: 0 },
    dailyClicks: [], hourlyHeatmap: [], trafficSources: [], countryBreakdown: [],
    deviceBreakdown: [], topLinks: [], peakHours: [], visitorType: [], utmSources: [], clicksByDow: [],
    meta: {},
  };
}
