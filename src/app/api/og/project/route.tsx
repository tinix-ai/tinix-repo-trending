import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { projects } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export const runtime = 'edge';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get('id');

  if (!projectId) {
    return new Response('Missing project id', { status: 400 });
  }

  try {
    const [project] = await db
      .select({
        name: projects.name,
        fullName: projects.fullName,
        description: projects.description,
        stars: projects.stars,
        forks: projects.forks,
        downloads: projects.downloads,
        likes: projects.likes,
        ownerName: projects.ownerName,
        ownerAvatarUrl: projects.ownerAvatarUrl,
        source: projects.source,
        primaryLanguage: projects.primaryLanguage,
        categories: projects.categories,
      })
      .from(projects)
      .where(eq(projects.id, projectId))
      .limit(1);

    if (!project) {
      return new Response('Project not found', { status: 404 });
    }

    const isGitHub = project.source === 'github';
    const primaryStat = isGitHub
      ? `⭐ ${formatNum(project.stars ?? 0)}`
      : `❤️ ${formatNum(project.likes ?? 0)}`;
    const secondaryStat = isGitHub
      ? `🍴 ${formatNum(project.forks ?? 0)}`
      : `⬇️ ${formatNum(project.downloads ?? 0)}`;

    const sourceLabel = isGitHub ? 'GitHub' : 'HuggingFace';
    const sourceColor = isGitHub ? '#238636' : '#FF9D00';
    const sourceBg = isGitHub ? '#0d1117' : '#1a1a2e';

    const desc = project.description
      ? project.description.length > 110
        ? project.description.slice(0, 107) + '...'
        : project.description
      : 'An open source project on TiniX Repo Trending';

    const topCategories = (project.categories ?? []).slice(0, 3);

    return new ImageResponse(
      (
        <div
          style={{
            width: '1200px',
            height: '630px',
            display: 'flex',
            flexDirection: 'column',
            background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)',
            fontFamily: 'system-ui, -apple-system, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Background grid */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'linear-gradient(rgba(100,100,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(100,100,255,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px',
            }}
          />
          {/* Glow top-right */}
          <div
            style={{
              position: 'absolute',
              top: '-100px',
              right: '-100px',
              width: '400px',
              height: '400px',
              background: 'radial-gradient(circle, rgba(99,102,241,0.3) 0%, transparent 70%)',
              borderRadius: '50%',
            }}
          />

          {/* Header bar */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '28px 48px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  color: 'white',
                  fontWeight: '700',
                }}
              >
                T
              </div>
              <span style={{ color: '#a5b4fc', fontSize: '18px', fontWeight: '600' }}>
                TiniX Repo Trending
              </span>
            </div>
            <div
              style={{
                background: sourceColor + '22',
                border: `1px solid ${sourceColor}66`,
                color: sourceColor,
                padding: '6px 16px',
                borderRadius: '100px',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              {sourceLabel}
            </div>
          </div>

          {/* Main content */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '40px 48px 36px',
              gap: '20px',
            }}
          >
            {/* Project name row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              {project.ownerAvatarUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={project.ownerAvatarUrl}
                  width={52}
                  height={52}
                  style={{ borderRadius: '50%', border: '2px solid rgba(255,255,255,0.15)' }}
                  alt=""
                />
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: '15px' }}>
                  {project.ownerName}
                </span>
                <span
                  style={{
                    color: 'white',
                    fontSize: '32px',
                    fontWeight: '700',
                    lineHeight: 1.1,
                  }}
                >
                  {project.name}
                </span>
              </div>
            </div>

            {/* Description */}
            <p
              style={{
                color: 'rgba(255,255,255,0.7)',
                fontSize: '18px',
                lineHeight: '1.5',
                margin: 0,
              }}
            >
              {desc}
            </p>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: '24px', marginTop: '8px' }}>
              <StatPill label={primaryStat} />
              <StatPill label={secondaryStat} />
              {project.primaryLanguage && (
                <StatPill label={`💻 ${project.primaryLanguage}`} />
              )}
            </div>

            {/* Categories */}
            {topCategories.length > 0 && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {topCategories.map((cat) => (
                  <div
                    key={cat}
                    style={{
                      background: 'rgba(99,102,241,0.2)',
                      border: '1px solid rgba(99,102,241,0.4)',
                      color: '#a5b4fc',
                      padding: '4px 14px',
                      borderRadius: '100px',
                      fontSize: '13px',
                      fontWeight: '500',
                    }}
                  >
                    {cat}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: '16px 48px',
              borderTop: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
              trending.tinix.ai
            </span>
            <span
              style={{
                background: 'linear-gradient(90deg, #6366f1, #a78bfa)',
                backgroundClip: 'text',
                WebkitBackgroundClip: 'text',
                color: 'transparent',
                fontSize: '14px',
                fontWeight: '600',
              }}
            >
              Discover Open Source AI Projects
            </span>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        headers: {
          'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        },
      }
    );
  } catch {
    return new Response('Failed to generate image', { status: 500 });
  }
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

function StatPill({ label }: { label: string }) {
  return (
    <div
      style={{
        background: 'rgba(255,255,255,0.08)',
        border: '1px solid rgba(255,255,255,0.12)',
        color: 'rgba(255,255,255,0.85)',
        padding: '8px 18px',
        borderRadius: '100px',
        fontSize: '16px',
        fontWeight: '500',
      }}
    >
      {label}
    </div>
  );
}
