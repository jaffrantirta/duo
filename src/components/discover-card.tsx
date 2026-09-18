"use client";

import { useTransition } from "react";
import { swipeCardAction } from "@/app/(app)/discover/actions";
import { DiscoverLoading } from "@/components/discover-loading";
import { Button } from "@/components/ui/button";
import type { DiscoverCard } from "@/lib/discover";
import { planEmoji } from "@/lib/plan-types";

export function DiscoverCardView({ card }: { card: DiscoverCard }) {
  const [isPending, startTransition] = useTransition();

  if (isPending) return <DiscoverLoading />;

  function swipe(decision: boolean) {
    startTransition(async () => {
      await swipeCardAction(card.id, decision);
    });
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-card p-8 text-center">
      <p className="text-6xl" aria-hidden>
        {planEmoji(card.type)}
      </p>
      <h2 className="font-display text-2xl font-bold">{card.title}</h2>
      <p className="text-muted-foreground">{card.description}</p>

      <div className="flex w-full gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="h-14 flex-1 rounded-2xl text-2xl"
          onClick={() => swipe(false)}
        >
          <span aria-hidden>✖️</span>
          <span className="sr-only">No</span>
        </Button>
        <Button type="button" size="lg" className="h-14 flex-1 rounded-2xl text-2xl" onClick={() => swipe(true)}>
          <span aria-hidden>❤️</span>
          <span className="sr-only">Yes</span>
        </Button>
      </div>
    </div>
  );
}
