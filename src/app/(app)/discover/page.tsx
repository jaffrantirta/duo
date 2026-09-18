import Link from "next/link";
import { DiscoverCardView } from "@/components/discover-card";
import { buttonVariants } from "@/components/ui/button";
import { getNextCard } from "@/lib/discover";
import { requireCouple } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function DiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ matched?: string }>;
}) {
  const { matched } = await searchParams;
  const { user, couple } = await requireCouple();
  const card = await getNextCard(couple.id, user.id);

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">Discover</h1>
        <Link href="/discover/new" className={cn(buttonVariants({ size: "sm" }), "rounded-2xl")}>
          + Add idea
        </Link>
      </header>

      {matched === "1" && (
        <p role="status" className="rounded-2xl bg-accent p-4 text-center text-base font-medium">
          It&apos;s a match! 🎉 Added to your plans.
        </p>
      )}

      {card ? (
        <DiscoverCardView card={card} />
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-3 text-center">
          <p className="text-6xl" aria-hidden>
            ✨
          </p>
          <p className="text-lg text-muted-foreground">
            You&apos;re all caught up. Add your own idea for your partner to discover.
          </p>
        </div>
      )}
    </div>
  );
}
