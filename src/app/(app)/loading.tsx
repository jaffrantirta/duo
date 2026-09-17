export default function AppLoading() {
  return (
    <div role="status" className="flex flex-1 flex-col gap-6">
      <span className="sr-only">Loading…</span>
      <div aria-hidden className="h-40 animate-pulse rounded-3xl bg-card" />
      <div aria-hidden className="h-16 animate-pulse rounded-3xl bg-card" />
      <div aria-hidden className="h-16 animate-pulse rounded-3xl bg-card" />
    </div>
  );
}
