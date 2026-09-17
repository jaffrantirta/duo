"use client";

import { useActionState, useState } from "react";
import type { PlanFormState } from "@/app/(app)/plans/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_TYPES } from "@/lib/plan-types";
import { cn } from "@/lib/utils";

type Props = {
  action: (state: PlanFormState, formData: FormData) => Promise<PlanFormState>;
  submitLabel: string;
  pendingLabel: string;
  defaults?: { type: string; title: string; onDate: string; atTime: string };
};

export function PlanForm({ action, submitLabel, pendingLabel, defaults }: Props) {
  const [state, formAction, pending] = useActionState<PlanFormState, FormData>(action, {});
  const [type, setType] = useState(defaults?.type ?? "dinner");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />

      <div className="space-y-2">
        <Label>What kind of plan?</Label>
        <div className="grid grid-cols-4 gap-2">
          {PLAN_TYPES.map((planType) => (
            <button
              key={planType.slug}
              type="button"
              onClick={() => setType(planType.slug)}
              aria-pressed={type === planType.slug}
              className={cn(
                "flex flex-col items-center gap-1 rounded-2xl border p-3 text-xs",
                type === planType.slug ? "border-ring bg-accent" : "border-border bg-card",
              )}
            >
              <span className="text-2xl" aria-hidden>
                {planType.emoji}
              </span>
              {planType.label}
            </button>
          ))}
        </div>
        {state.fieldErrors?.type && <p className="text-sm text-destructive">{state.fieldErrors.type}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="title">What is it?</Label>
        <Input
          id="title"
          name="title"
          required
          maxLength={80}
          placeholder="Dinner at Ramen Danbo"
          defaultValue={state.values?.title ?? defaults?.title}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.title && <p className="text-sm text-destructive">{state.fieldErrors.title}</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="min-w-0 space-y-2">
          <Label htmlFor="onDate">When?</Label>
          <Input
            id="onDate"
            name="onDate"
            type="date"
            defaultValue={state.values?.onDate ?? defaults?.onDate}
            aria-invalid={Boolean(state.fieldErrors?.onDate)}
            className="h-12 rounded-2xl bg-card text-base"
          />
          {state.fieldErrors?.onDate && <p className="text-sm text-destructive">{state.fieldErrors.onDate}</p>}
        </div>

        <div className="min-w-0 space-y-2">
          <Label htmlFor="atTime">Time</Label>
          <Input
            id="atTime"
            name="atTime"
            type="time"
            defaultValue={state.values?.atTime ?? defaults?.atTime}
            aria-invalid={Boolean(state.fieldErrors?.atTime)}
            className="h-12 rounded-2xl bg-card text-base"
          />
          {state.fieldErrors?.atTime && <p className="text-sm text-destructive">{state.fieldErrors.atTime}</p>}
        </div>
      </div>

      <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
        {pending ? pendingLabel : submitLabel}
      </Button>
    </form>
  );
}
