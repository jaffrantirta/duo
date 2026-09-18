import { addCardAction } from "@/app/(app)/discover/actions";
import { DiscoverCardForm } from "@/components/discover-card-form";
import { requireCouple } from "@/lib/session";

export default async function NewDiscoverCardPage() {
  await requireCouple();

  return (
    <div className="flex flex-1 flex-col gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Add an idea</h1>
      <DiscoverCardForm action={addCardAction} />
    </div>
  );
}
