"use client";

import { useState } from "react";
import { regenerateInviteAction } from "@/app/(app)/home/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitingForPartner({ inviteUrl }: { inviteUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Duo", text: "Come be my duo 💕", url: inviteUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <SignOutButton />
      </div>

      <section className="space-y-6 rounded-3xl bg-lilac/60 p-8">
        <p className="text-5xl" aria-hidden>
          💌
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Waiting for your person</h1>
        <p className="text-lg text-foreground/80">
          Send them this link. When they join, your little world opens up.
        </p>

        {inviteUrl ? (
          <div className="space-y-3">
            <Input
              readOnly
              value={inviteUrl}
              data-testid="invite-url"
              aria-label="Invite link"
              className="h-12 rounded-2xl bg-card text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button size="lg" className="h-12 w-full rounded-2xl text-base" onClick={share}>
              {copied ? "Copied!" : "Share invite link"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-foreground/70">Your last link expired.</p>
        )}

        <form action={regenerateInviteAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Make a new link
          </Button>
        </form>
      </section>
    </div>
  );
}
