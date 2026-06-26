import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shareLinks, shareEvents, projects } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rows = await db.execute(sql`
      SELECT
        sl.code,
        sl.created_at as "createdAt",
        sl.project_id as "projectId",
        p.full_name as "projectFullName",
        COUNT(se.id)::int as "totalClicks"
      FROM share_links sl
      JOIN projects p ON p.id = sl.project_id
      LEFT JOIN share_events se ON se.link_code = sl.code AND se.device_type != 'bot'
      GROUP BY sl.code, sl.created_at, sl.project_id, p.full_name
      ORDER BY "totalClicks" DESC, sl.created_at DESC
      LIMIT 200
    `);

    return NextResponse.json({ links: rows });
  } catch (err) {
    console.error('[ShareLink] List error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
