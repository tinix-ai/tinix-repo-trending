import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shareLinks, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

// Simple nanoid-like generator (no external dep needed)
function generateCode(length = 8): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://trending.tinix.ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { projectId, title, utmSource } = body as {
      projectId?: string;
      title?: string;
      utmSource?: string;
    };

    if (!projectId) {
      return NextResponse.json({ error: 'projectId is required' }, { status: 400 });
    }

    // Verify project exists
    const [project] = await db
      .select({ id: projects.id, fullName: projects.fullName, slug: projects.slug })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check if a share link for this project+source already exists (reuse)
    const [existing] = await db
      .select({ code: shareLinks.code })
      .from(shareLinks)
      .where(eq(shareLinks.projectId, projectId))
      .limit(1);

    let code: string;

    if (existing) {
      code = existing.code;
    } else {
      // Generate a unique code
      let attempts = 0;
      do {
        code = generateCode(8);
        const conflict = await db
          .select({ code: shareLinks.code })
          .from(shareLinks)
          .where(eq(shareLinks.code, code))
          .limit(1);
        if (conflict.length === 0) break;
        attempts++;
      } while (attempts < 10);

      await db.insert(shareLinks).values({
        code,
        projectId,
        title: title || project.fullName,
        utmSource: utmSource || null,
      });
    }

    const shortUrl = `${BASE_URL}/s/${code}`;
    const ogImageUrl = `${BASE_URL}/api/og/project?id=${projectId}`;

    return NextResponse.json({
      code,
      shortUrl,
      ogImageUrl,
      project: {
        id: project.id,
        fullName: project.fullName,
        slug: project.slug,
      },
    });
  } catch (err) {
    console.error('[ShareLink] Create error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
