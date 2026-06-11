export default function ProjectLoading() {
  return (
    <div className="w-full min-h-screen bg-[var(--color-bg-primary)] animate-pulse">
      {/* Hero Skeleton */}
      <section className="apple-tile-light w-full py-16 lg:py-24 border-b border-[var(--color-divider-soft)]">
        <div className="page-container max-w-5xl">
          <div className="h-6 w-24 bg-[var(--color-divider-soft)] rounded-md mb-6" />
          <div className="h-12 w-3/4 bg-[var(--color-divider-soft)] rounded-xl mb-6" />
          <div className="h-4 w-1/2 bg-[var(--color-divider-soft)] rounded-md mb-8" />
          
          <div className="flex gap-4">
            <div className="h-10 w-32 bg-[var(--color-divider-soft)] rounded-full" />
            <div className="h-10 w-32 bg-[var(--color-divider-soft)] rounded-full" />
          </div>
        </div>
      </section>

      {/* Content Skeleton */}
      <section className="apple-tile-parchment w-full py-16">
        <div className="page-container max-w-5xl grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
          <div className="space-y-6">
            <div className="h-8 w-1/3 bg-[var(--color-divider-soft)] rounded-md" />
            <div className="h-4 w-full bg-[var(--color-divider-soft)] rounded-md" />
            <div className="h-4 w-full bg-[var(--color-divider-soft)] rounded-md" />
            <div className="h-4 w-5/6 bg-[var(--color-divider-soft)] rounded-md" />
            <div className="h-64 w-full bg-[var(--color-divider-soft)] rounded-xl mt-8" />
          </div>
          <div className="space-y-6">
            <div className="h-48 w-full bg-[var(--color-divider-soft)] rounded-xl" />
            <div className="h-48 w-full bg-[var(--color-divider-soft)] rounded-xl" />
          </div>
        </div>
      </section>
    </div>
  );
}
