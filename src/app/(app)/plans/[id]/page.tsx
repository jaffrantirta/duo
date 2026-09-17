import { notFound } from "next/navigation";
import { updatePlanAction } from "@/app/(app)/plans/actions";
import { PlanActions } from "@/components/plan-actions";
import { PlanForm } from "@/components/plan-form";
import { getPlan, type PlanStatus } from "@/lib/plans";
import { requireCouple } from "@/lib/session";

export default async function EditPlanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { couple } = await requireCouple();
  const plan = await getPlan(couple.id, id);
  if (!plan) notFound();

  return (
    <div className="flex flex-1 flex-col gap-8">
      <h1 className="font-display text-4xl font-bold tracking-tight">Edit plan</h1>

      <PlanForm
        action={updatePlanAction.bind(null, plan.id)}
        submitLabel="Save plan"
        pendingLabel="Saving…"
        defaults={{
          type: plan.type,
          title: plan.title,
          onDate: plan.onDate ?? "",
          atTime: plan.atTime ?? "",
        }}
      />

      <PlanActions plan={{ id: plan.id, status: plan.status as PlanStatus }} />
    </div>
  );
}
