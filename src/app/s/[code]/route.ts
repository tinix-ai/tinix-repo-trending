import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shareLinks, shareEvents, projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

function detectDevice(ua: string): 'mobile' | 'desktop' | 'bot' {
  if (!ua) return 'desktop';
  const lower = ua.toLowerCase();
  if (/bot|crawler|spider|slurp|bingbot|googlebot/i.test(lower)) return 'bot';
  if (/mobile|android|iphone|ipad|blackberry|windows phone/i.test(lower)) return 'mobile';
  return 'desktop';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  if (!code) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Fetch the short link record
    const [link] = await db
      .select({
        id: shareLinks.id,
        code: shareLinks.code,
        projectId: shareLinks.projectId,
        expiresAt: shareLinks.expiresAt,
      })
      .from(shareLinks)
      .where(eq(shareLinks.code, code))
      .limit(1);

    if (!link) {
      return NextResponse.redirect(new URL('/?ref=invalid_link', request.url));
    }

    // Check expiry
    if (link.expiresAt && new Date(link.expiresAt) < new Date()) {
      return NextResponse.redirect(new URL('/?ref=expired_link', request.url));
    }

    // Fetch project slug for the destination URL
    const [project] = await db
      .select({ slug: projects.slug, id: projects.id })
      .from(projects)
      .where(eq(projects.id, link.projectId))
      .limit(1);

    if (!project) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Record click event (fire-and-forget — do not block redirect)
    const ua = request.headers.get('user-agent') || '';
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      '';
    const ipHash = ip ? createHash('sha256').update(ip).digest('hex').slice(0, 16) : null;
    const country =
      request.headers.get('cf-ipcountry') ||
      request.headers.get('x-vercel-ip-country') ||
      null;
    const referrer = request.headers.get('referer') || null;
    const deviceType = detectDevice(ua);

    // Non-blocking insert
    db.insert(shareEvents)
      .values({
        linkCode: code,
        referrer,
        userAgent: ua.slice(0, 512),
        ipHash,
        country,
        deviceType,
      })
      .catch((err) => console.error('[ShareLink] Failed to record click event:', err));

    // Build destination URL with UTM tracking
    const destUrl = new URL(`/project/${project.slug}-${project.id}`, request.url);
    destUrl.searchParams.set('ref', 'share');
    destUrl.searchParams.set('utm_source', 'short_link');
    destUrl.searchParams.set('utm_medium', 'social');

    return NextResponse.redirect(destUrl, {
      status: 302, // Use 302 (not 301) so clicks are always tracked fresh
    });
  } catch (err) {
    console.error('[ShareLink] Redirect error:', err);
    return NextResponse.redirect(new URL('/', request.url));
  }
}
