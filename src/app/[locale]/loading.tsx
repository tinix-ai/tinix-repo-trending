export default function Loading() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 text-center">
      <div className="w-12 h-12 rounded-full border-2 border-[var(--color-divider-soft)] border-t-[var(--color-action-blue)] animate-spin mb-6"></div>
      <p className="text-[var(--color-ink-muted-80)] text-sm animate-pulse">
        Loading data...
      </p>
    </div>
  );
}
