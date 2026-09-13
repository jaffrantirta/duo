"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🫠
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">Oops, something went wobbly</h1>
      <p className="text-lg text-muted-foreground">It is not you, it is us. Give it another try.</p>
      <Button size="lg" className="h-12 rounded-2xl text-base" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
