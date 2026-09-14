"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "@/app/invite/[token]/actions";
import { InviteProblemView } from "@/components/invite-problem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { token: string; inviterName: string; defaultName: string };

export function AcceptInviteForm({ token, inviterName, defaultName }: Props) {
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction.bind(null, token),
    {},
  );

  if (state.reason) return <InviteProblemView reason={state.reason} />;

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="text-6xl" aria-hidden>
          💕
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">{inviterName} invited you to Duo</h1>
        <p className="text-lg text-muted-foreground">Join to start your little world together.</p>
      </header>

      <form action={formAction} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">What should we call you?</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={40}
            autoComplete="given-name"
            defaultValue={state.name ?? defaultName}
            aria-invalid={Boolean(state.nameError)}
            className="h-12 rounded-2xl bg-card text-base"
          />
          {state.nameError && <p className="text-sm text-destructive">{state.nameError}</p>}
        </div>
        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
          {pending ? "Joining…" : `Join ${inviterName}`}
        </Button>
      </form>
    </div>
  );
}
