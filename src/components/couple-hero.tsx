import { SignOutButton } from "@/components/sign-out-button";

type Props = { firstName: string; secondName: string; days: number };

export function CoupleHero({ firstName, secondName, days }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <SignOutButton />
      </div>

      <section className="rounded-3xl bg-peach/60 p-8">
        <h1 data-testid="couple-names" className="font-display text-4xl font-bold tracking-tight">
          {firstName} <span aria-hidden>❤️</span> {secondName}
        </h1>
        <p className="mt-6 text-lg text-foreground/80">
          {days === 0 ? (
            "your first day together ✨"
          ) : (
            <>
              together for{" "}
              <span className="font-display text-6xl font-bold text-foreground">{days.toLocaleString("en")}</span>{" "}
              {days === 1 ? "day" : "days"}
            </>
          )}
        </p>
      </section>
    </div>
  );
}
