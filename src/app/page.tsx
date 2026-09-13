import { redirect } from "next/navigation";
import { getCoupleForUser } from "@/lib/couples";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const couple = await getCoupleForUser(session.user.id);
  redirect(couple ? "/home" : "/onboarding");
}
