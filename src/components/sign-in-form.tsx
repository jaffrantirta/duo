"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Props = { callbackURL: string; googleEnabled: boolean; linkError?: boolean };

export function SignInForm({ callbackURL, googleEnabled, linkError = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(
    linkError ? "That link expired or was already used. Get a new one below." : null,
  );

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("email");
    const { error: sendError } = await authClient.signIn.magicLink({
      email,
      callbackURL,
      errorCallbackURL: "/sign-in?error=link",
    });
    setPending(null);
    if (sendError) {
      setError("We couldn't send the email, try again");
      return;
    }
    router.push(`/check-email?email=${encodeURIComponent(email)}`);
  }

  async function continueWithGoogle() {
    setError(null);
    setPending("google");
    const { error: googleError } = await authClient.signIn.social({ provider: "google", callbackURL });
    if (googleError) {
      setPending(null);
      setError("Google sign-in didn't work, try again");
    }
  }

  return (
    <div className="space-y-6">
      {googleEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-2xl bg-card text-base"
            disabled={pending !== null}
            onClick={continueWithGoogle}
          >
            {pending === "google" ? "Opening Google…" : "Continue with Google"}
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={sendLink} className="space-y-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending !== null}>
          {pending === "email" ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
