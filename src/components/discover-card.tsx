import { swipeCardAction } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";
import type { DiscoverCard } from "@/lib/discover";
import { planEmoji } from "@/lib/plan-types";

export function DiscoverCardView({ card }: { card: DiscoverCard }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-6 rounded-3xl border border-border bg-card p-8 text-center">
      <p className="text-6xl" aria-hidden>
        {planEmoji(card.type)}
      </p>
      <h2 className="font-display text-2xl font-bold">{card.title}</h2>
      <p className="text-muted-foreground">{card.description}</p>

      <div className="flex w-full gap-3">
        <form action={swipeCardAction.bind(null, card.id, false)} className="flex-1">
          <Button type="submit" variant="outline" size="lg" className="h-14 w-full rounded-2xl text-2xl">
            <span aria-hidden>✖️</span>
            <span className="sr-only">No</span>
          </Button>
        </form>
        <form action={swipeCardAction.bind(null, card.id, true)} className="flex-1">
          <Button type="submit" size="lg" className="h-14 w-full rounded-2xl text-2xl">
            <span aria-hidden>❤️</span>
            <span className="sr-only">Yes</span>
          </Button>
        </form>
      </div>
    </div>
  );
}
