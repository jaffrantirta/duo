import { CoupleHero } from "@/components/couple-hero";
import { WaitingForPartner } from "@/components/waiting-for-partner";
import { daysTogether } from "@/lib/dates";
import { getActiveInvite, inviteUrl } from "@/lib/invites";
import { requireCouple } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export default async function HomePage() {
  const { couple } = await requireCouple();

  if (couple.members.length < 2) {
    const invite = await getActiveInvite(couple.id);
    return <WaitingForPartner inviteUrl={invite ? inviteUrl(invite.token) : null} />;
  }

  const [first, second] = couple.members;
  const days = daysTogether(couple.togetherSince, await getViewerTimeZone());
  return <CoupleHero firstName={first.name} secondName={second.name} days={days} />;
}
