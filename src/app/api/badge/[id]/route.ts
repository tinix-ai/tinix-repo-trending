import { NextRequest } from "next/server";
import { getProjectById, getProjectDynamicRank } from "@/lib/db/queries";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { searchParams } = request.nextUrl;
    
    // Parse time range days parameter: 1 (daily), 7 (weekly), 30 (monthly)
    const daysParam = searchParams.get("days");
    const days = daysParam === "7" ? 7 : daysParam === "30" ? 30 : 1;
    const periodLabel = days === 7 ? "Weekly" : days === 30 ? "Monthly" : "Daily";

    // 1. Fetch project to check if it exists
    const project = await getProjectById(id);
    if (!project) {
      return new Response(createErrorBadge("Not Found"), {
        headers: {
          "Content-Type": "image/svg+xml",
          "Cache-Control": "no-cache, no-store, must-revalidate",
        },
      });
    }

    // 2. Fetch project rank dynamically
    const rankInfo = await getProjectDynamicRank(id, days);
    const rank = rankInfo ? rankInfo.rank : null;

    // 3. Generate SVG badge based on rank
    const svg = createRankBadge(project.name, rank, periodLabel);

    return new Response(svg, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "max-age=300, s-maxage=300, stale-while-revalidate=60", // Cache for 5 mins
      },
    });
  } catch (error) {
    console.error("Error generating SVG badge:", error);
    return new Response(createErrorBadge("Error"), {
      headers: {
        "Content-Type": "image/svg+xml",
      },
    });
  }
}

function createErrorBadge(message: string): string {
  const leftText = "Tinix";
  const rightText = message;
  const leftWidth = 45;
  const rightWidth = 75;
  const width = leftWidth + rightWidth;

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20">
      <linearGradient id="g" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <mask id="m">
        <rect width="${width}" height="20" rx="4" fill="#fff"/>
      </mask>
      <g mask="url(#m)">
        <rect width="${leftWidth}" height="20" fill="#1e293b"/>
        <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="#ef4444"/>
        <rect width="${width}" height="20" fill="url(#g)"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">
        <text x="${leftWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${leftText}</text>
        <text x="${leftWidth / 2}" y="13">${leftText}</text>
        <text x="${leftWidth + rightWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${rightText}</text>
        <text x="${leftWidth + rightWidth / 2}" y="13">${rightText}</text>
      </g>
    </svg>
  `.trim();
}

function createRankBadge(projectName: string, rank: number | null, period: string): string {
  const cleanName = projectName.replace(/[&<>'"]/g, (tag) => {
    const replace: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "'": "&#39;",
      '"': "&quot;",
    };
    return replace[tag] || tag;
  });

  const leftText = `Tinix | ${cleanName}`;
  const rightText = rank ? `#${rank} ${period}` : "Listed";

  // Calculate approximate text widths for standard layout
  const leftWidth = Math.max(100, Math.ceil(leftText.length * 6.5) + 16);
  const rightWidth = Math.ceil(rightText.length * 6.5) + 16;
  const width = leftWidth + rightWidth;

  // Badge colors depending on Rank
  let color = "#0066cc"; // Action Blue
  if (rank === 1) {
    color = "#d97706"; // Amber Gold
  } else if (rank === 2) {
    color = "#64748b"; // Slate Silver
  } else if (rank === 3) {
    color = "#b45309"; // Bronze
  } else if (!rank) {
    color = "#475569"; // Slate Grey
  }

  return `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="20" viewBox="0 0 ${width} 20">
      <linearGradient id="g" x2="0" y2="100%">
        <stop offset="0" stop-color="#bbb" stop-opacity=".1"/>
        <stop offset="1" stop-opacity=".1"/>
      </linearGradient>
      <mask id="m">
        <rect width="${width}" height="20" rx="4" fill="#fff"/>
      </mask>
      <g mask="url(#m)">
        <rect width="${leftWidth}" height="20" fill="#1e293b"/>
        <rect x="${leftWidth}" width="${rightWidth}" height="20" fill="${color}"/>
        <rect width="${width}" height="20" fill="url(#g)"/>
      </g>
      <g fill="#fff" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="11" font-weight="bold">
        <text x="${leftWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${leftText}</text>
        <text x="${leftWidth / 2}" y="13">${leftText}</text>
        <text x="${leftWidth + rightWidth / 2}" y="14" fill="#010101" fill-opacity=".3">${rightText}</text>
        <text x="${leftWidth + rightWidth / 2}" y="13">${rightText}</text>
      </g>
    </svg>
  `.trim();
}
