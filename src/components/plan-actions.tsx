"use client";

import { deletePlanAction, setPlanStatusAction } from "@/app/(app)/plans/actions";
import { Button } from "@/components/ui/button";
import type { Plan, PlanStatus } from "@/lib/plans";

const MOVES: { status: PlanStatus; label: string }[] = [
  { status: "idea", label: "💭 Back to idea" },
  { status: "planned", label: "📌 Plan it" },
  { status: "done", label: "❤️ Mark done" },
];

export function PlanActions({ plan }: { plan: Plan }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-2">
        {MOVES.filter((move) => move.status !== plan.status).map((move) => (
          <form key={move.status} action={setPlanStatusAction.bind(null, plan.id, move.status)}>
            <Button type="submit" variant="outline" className="h-12 w-full rounded-2xl bg-card text-base">
              {move.label}
            </Button>
          </form>
        ))}
      </div>

      <form
        action={deletePlanAction.bind(null, plan.id)}
        onSubmit={(event) => {
          if (!confirm("Delete this plan?")) event.preventDefault();
        }}
      >
        <Button type="submit" variant="ghost" className="w-full text-destructive">
          Delete plan
        </Button>
      </form>
    </div>
  );
}
