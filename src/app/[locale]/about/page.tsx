import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About | Tinix Repo Trending",
  description: "About Tinix Repo Trending - Tracking momentum across open source.",
};

export default function AboutPage() {
  return (
    <div className="page-container py-12">
      <div className="max-w-3xl mx-auto prose prose-invert prose-blue">
        <h1 className="text-4xl font-extrabold tracking-tight text-[var(--color-ink)] mb-8">
          About Tinix Repo Trending
        </h1>
        
        <div className="apple-utility-card p-8 mb-8 text-[var(--color-ink)]">
          <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)] mb-6">
            Tinix Repo Trending is an advanced open-source project tracker designed to identify projects gaining early momentum before they hit the mainstream.
          </p>
          <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)]">
            We continuously monitor both GitHub and HuggingFace to calculate a unique <strong>Velocity Score</strong> based on a proprietary algorithm that weights stars, forks, contributors, and downloads over specific time periods.
          </p>
        </div>

        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4 mt-12">How it works</h2>
        <ul className="space-y-4 text-[var(--color-ink-muted-80)] list-disc pl-5">
          <li><strong>Data Collection:</strong> Automated workers crawl GitHub repositories and HuggingFace models/datasets periodically to capture snapshots of their metrics.</li>
          <li><strong>Momentum Calculation:</strong> We compare current metrics with historical snapshots (e.g. 7 days ago) to determine the absolute growth (deltas) of a project.</li>
          <li><strong>Scoring:</strong>
            <ul className="list-circle pl-5 mt-2 space-y-2">
              <li>For GitHub: <code className="text-sm bg-[var(--color-divider-soft)] px-1.5 py-0.5 rounded text-[var(--color-ink)]">Stars Gained + (Forks Gained * 2) + (Contributors Gained * 5)</code></li>
              <li>For HuggingFace: <code className="text-sm bg-[var(--color-divider-soft)] px-1.5 py-0.5 rounded text-[var(--color-ink)]">Likes Gained + (Downloads Gained / 1000)</code></li>
            </ul>
          </li>
          <li><strong>Categorization:</strong> Projects are automatically categorized using metadata and LLM-powered summarization.</li>
        </ul>

        <h2 className="text-2xl font-bold text-[var(--color-ink)] mb-4 mt-12">Open Source</h2>
        <p className="text-lg leading-relaxed text-[var(--color-ink-muted-80)]">
          Tinix Repo Trending is proudly open source. You can view the code, contribute, or run your own instance.
        </p>
      </div>
    </div>
  );
}
