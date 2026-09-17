import { CoupleHero } from "@/components/couple-hero";
import { NextPlanCard } from "@/components/next-plan-card";
import { WaitingForPartner } from "@/components/waiting-for-partner";
import { daysTogether, todayInTimeZone } from "@/lib/dates";
import { getActiveInvite, inviteUrl } from "@/lib/invites";
import { getCachedNextPlan } from "@/lib/plans";
import { requireCouple } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export default async function HomePage() {
  const { couple } = await requireCouple();

  if (couple.members.length < 2) {
    const invite = await getActiveInvite(couple.id);
    return <WaitingForPartner inviteUrl={invite ? inviteUrl(invite.token) : null} />;
  }

  const [first, second] = couple.members;
  const timeZone = await getViewerTimeZone();
  const days = daysTogether(couple.togetherSince, timeZone);
  const nextPlan = await getCachedNextPlan(couple.id, todayInTimeZone(timeZone));

  return (
    <div className="flex flex-1 flex-col gap-6">
      <CoupleHero firstName={first.name} secondName={second.name} days={days} />
      {nextPlan && <NextPlanCard plan={nextPlan} />}
    </div>
  );
}
