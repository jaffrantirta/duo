const CAPTIONS = [
  "Finding your next idea…",
  "Shuffling the deck…",
  "Hunting for something fun…",
  "One sec, matchmaking…",
];

export function DiscoverLoading() {
  const caption = CAPTIONS[Math.floor(Math.random() * CAPTIONS.length)];

  return (
    <div role="status" className="flex flex-1 flex-col items-center justify-center gap-4">
      <span className="sr-only">Loading…</span>
      <p aria-hidden className="animate-bounce text-6xl">
        ❤️
      </p>
      <p aria-hidden className="text-lg text-muted-foreground">
        {caption}
      </p>
    </div>
  );
}
