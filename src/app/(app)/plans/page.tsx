import Link from "next/link";
import { PlanRow } from "@/components/plan-row";
import { buttonVariants } from "@/components/ui/button";
import { listPlans, type Plan } from "@/lib/plans";
import { requireCouple } from "@/lib/session";
import { cn } from "@/lib/utils";

export default async function PlansPage() {
  const { couple } = await requireCouple();
  const { idea, planned, done } = await listPlans(couple.id);
  const total = idea.length + planned.length + done.length;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <header className="flex items-center justify-between gap-3">
        <h1 className="font-display text-4xl font-bold tracking-tight">Our plans</h1>
        <Link href="/plans/new" className={cn(buttonVariants({ size: "sm" }), "rounded-2xl")}>
          + New
        </Link>
      </header>

      {total === 0 ? (
        <div className="flex flex-1 flex-col justify-center gap-3 text-center">
          <p className="text-6xl" aria-hidden>
            💭
          </p>
          <p className="text-lg text-muted-foreground">
            Nothing planned yet. Add the first thing you want to do together.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          <PlanSection title="📌 Planned" plans={planned} />
          <PlanSection title="💭 Ideas" plans={idea} />
          <PlanSection title="❤️ Done" plans={done} />
        </div>
      )}
    </div>
  );
}

function PlanSection({ title, plans }: { title: string; plans: Plan[] }) {
  if (plans.length === 0) return null;

  return (
    <section className="space-y-3">
      <h2 className="text-sm font-medium text-muted-foreground">{title}</h2>
      <ul className="space-y-2">
        {plans.map((plan) => (
          <PlanRow key={plan.id} plan={plan} />
        ))}
      </ul>
    </section>
  );
}
