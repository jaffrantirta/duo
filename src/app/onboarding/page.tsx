import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getCoupleForUser } from "@/lib/couples";
import { todayInTimeZone } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getCoupleForUser(user.id)) redirect("/home");
  const maxDate = todayInTimeZone(await getViewerTimeZone());

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="text-5xl" aria-hidden>
          🏡
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">{"Let's build your little world"}</h1>
        <p className="text-lg text-muted-foreground">Two quick things, then you can invite your person.</p>
      </header>
      <OnboardingForm defaultName={user.name} maxDate={maxDate} />
    </div>
  );
}
