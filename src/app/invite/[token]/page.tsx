import { AcceptInviteForm } from "@/components/accept-invite-form";
import { InviteProblemView } from "@/components/invite-problem";
import { SignInForm } from "@/components/sign-in-form";
import { googleEnabled } from "@/lib/auth";
import { getInvitePreview, getInviteView } from "@/lib/invites";
import { getSession } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();

  if (!session) {
    const preview = await getInvitePreview(token);
    if (!preview) return <InviteProblemView reason="not_found" />;

    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <header className="space-y-3">
          <p className="text-6xl" aria-hidden>
            💕
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {preview.inviterName} invited you to Duo
          </h1>
          <p className="text-lg text-muted-foreground">Sign in to join them.</p>
        </header>
        <SignInForm callbackURL={`/invite/${token}`} googleEnabled={googleEnabled} />
      </div>
    );
  }

  const view = await getInviteView(token, session.user.id);
  if (!view.ok) return <InviteProblemView reason={view.reason} />;

  return <AcceptInviteForm token={token} inviterName={view.inviterName} defaultName={session.user.name} />;
}
