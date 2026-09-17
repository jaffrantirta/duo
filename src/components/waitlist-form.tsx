"use client";

import { useActionState, useId } from "react";
import { joinWaitlistAction, type WaitlistFormState } from "@/app/waitlist-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaitlistForm() {
  const id = useId();
  const [state, formAction, pending] = useActionState<WaitlistFormState, FormData>(joinWaitlistAction, {});

  if (state.done) {
    return (
      <p className="rounded-2xl bg-mint/60 px-4 py-3 text-center text-sm font-medium">
        You&apos;re on the list 💌 We&apos;ll let you know.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1 space-y-1">
        <Label htmlFor={id} className="sr-only">
          Email
        </Label>
        <Input
          id={id}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(state.error)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button type="submit" size="lg" className="h-12 shrink-0 rounded-2xl text-base" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
