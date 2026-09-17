import Link from "next/link";
import { formatPlanDate } from "@/lib/plan-format";
import { planEmoji } from "@/lib/plan-types";
import type { Plan } from "@/lib/plans";

export function NextPlanCard({ plan }: { plan: Plan }) {
  return (
    <Link
      href={`/plans/${plan.id}`}
      data-testid="next-plan"
      className="flex items-center gap-4 rounded-3xl bg-mint/60 p-6"
    >
      <span className="text-3xl" aria-hidden>
        {planEmoji(plan.type)}
      </span>
      <span className="flex-1">
        <span className="block text-sm text-foreground/70">Next plan</span>
        <span className="block text-lg font-medium">{plan.title}</span>
        <span className="block text-sm text-foreground/70">{formatPlanDate(plan.onDate, plan.atTime)}</span>
      </span>
    </Link>
  );
}
