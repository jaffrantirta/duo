import Link from "next/link";
import { formatPlanDate } from "@/lib/plan-format";
import { planEmoji } from "@/lib/plan-types";
import type { Plan } from "@/lib/plans";

export function PlanRow({ plan }: { plan: Plan }) {
  const when = formatPlanDate(plan.onDate, plan.atTime);

  return (
    <li>
      <Link href={`/plans/${plan.id}`} className="flex items-center gap-3 rounded-3xl bg-card p-4">
        <span className="text-2xl" aria-hidden>
          {planEmoji(plan.type)}
        </span>
        <span className="flex-1">
          <span className="block font-medium">{plan.title}</span>
          {when && <span className="block text-sm text-muted-foreground">{when}</span>}
        </span>
      </Link>
    </li>
  );
}
