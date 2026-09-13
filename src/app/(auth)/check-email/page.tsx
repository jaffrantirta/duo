import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        💌
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">Check your inbox</h1>
      <p className="text-lg text-muted-foreground">
        We sent a sign-in link
        {email ? (
          <>
            {" "}
            to <span className="font-medium text-foreground">{email}</span>
          </>
        ) : null}
        . It expires in 15 minutes.
      </p>
      <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
        Use a different email
      </Link>
    </div>
  );
}
