import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { INVITE_PROBLEM_COPY } from "@/lib/invite-messages";
import type { InviteProblem } from "@/lib/invites";

export function InviteProblemView({ reason }: { reason: InviteProblem }) {
  const copy = INVITE_PROBLEM_COPY[reason];

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🥺
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">{copy.title}</h1>
      <p className="text-lg text-muted-foreground">{copy.body}</p>
      <Link href={copy.cta.href} className={buttonVariants({ size: "lg", className: "h-12 rounded-2xl text-base" })}>
        {copy.cta.label}
      </Link>
    </div>
  );
}
