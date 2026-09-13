import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { googleEnabled } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/redirects";
import { getSession } from "@/lib/session";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(params.callbackURL, "/");
  if (await getSession()) redirect(callbackURL);

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="font-display text-7xl font-bold tracking-tight">duo</p>
        <p className="text-lg text-muted-foreground">A little world for the two of you.</p>
      </header>
      <SignInForm callbackURL={callbackURL} googleEnabled={googleEnabled} linkError={params.error !== undefined} />
    </div>
  );
}
