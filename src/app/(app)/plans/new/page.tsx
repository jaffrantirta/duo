import { createPlanAction } from "@/app/(app)/plans/actions";
import { PlanForm } from "@/components/plan-form";
import { requireCouple } from "@/lib/session";

export default async function NewPlanPage() {
  await requireCouple();

  return (
    <div className="flex flex-1 flex-col gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">New plan</h1>
      <PlanForm action={createPlanAction} submitLabel="Add plan" pendingLabel="Adding…" />
    </div>
  );
}
