"use client";

import { useActionState, useState } from "react";
import type { AddCardFormState } from "@/app/(app)/discover/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLAN_TYPES } from "@/lib/plan-types";
import { cn } from "@/lib/utils";

type Props = {
  action: (state: AddCardFormState, formData: FormData) => Promise<AddCardFormState>;
};

export function DiscoverCardForm({ action }: Props) {
  const [state, formAction, pending] = useActionState<AddCardFormState, FormData>(action, {});
  const [type, setType] = useState(state.values?.type ?? "dinner");

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="type" value={type} />

      <div className="space-y-2">
        <Label>What kind of idea?</Label>
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
          placeholder="Try a new ramen place"
          defaultValue={state.values?.title}
          aria-invalid={Boolean(state.fieldErrors?.title)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.title && <p className="text-sm text-destructive">{state.fieldErrors.title}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Say a bit more</Label>
        <textarea
          id="description"
          name="description"
          required
          maxLength={200}
          rows={3}
          placeholder="What makes this worth doing together?"
          defaultValue={state.values?.description}
          aria-invalid={Boolean(state.fieldErrors?.description)}
          className="min-h-24 w-full rounded-2xl border border-input bg-card p-3 text-base outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 aria-invalid:border-destructive"
        />
        {state.fieldErrors?.description && (
          <p className="text-sm text-destructive">{state.fieldErrors.description}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
        {pending ? "Adding…" : "Add to your deck"}
      </Button>
    </form>
  );
}
