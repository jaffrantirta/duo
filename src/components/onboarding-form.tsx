"use client";

import { useActionState } from "react";
import { createCoupleAction, type OnboardingState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ defaultName, maxDate }: { defaultName: string; maxDate: string }) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(createCoupleAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">What should we call you?</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={40}
          autoComplete="given-name"
          defaultValue={state.values?.name ?? defaultName}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="togetherSince">When did you two get together?</Label>
        <Input
          id="togetherSince"
          name="togetherSince"
          type="date"
          required
          max={maxDate}
          defaultValue={state.values?.togetherSince}
          aria-invalid={Boolean(state.fieldErrors?.togetherSince)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.togetherSince && (
          <p className="text-sm text-destructive">{state.fieldErrors.togetherSince}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
        {pending ? "Creating…" : "Create our little world"}
      </Button>
    </form>
  );
}
