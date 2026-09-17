import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { findCoupleIdForUser, getCachedCoupleById, type CoupleWithMembers } from "@/lib/couples";

export type SessionUser = typeof auth.$Infer.Session.user;

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export async function requireCouple(): Promise<{ user: SessionUser; couple: CoupleWithMembers }> {
  const user = await requireUser();
  const coupleId = await findCoupleIdForUser(user.id);
  if (!coupleId) redirect("/onboarding");
  const couple = await getCachedCoupleById(coupleId);
  // A couple id with no rows here means it was deleted between the two lookups above — the
  // same narrow race the empty-rows guard above exists for. Treat it the same way.
  if (!couple) redirect("/onboarding");
  return { user, couple };
}
