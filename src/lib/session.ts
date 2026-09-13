import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { getCoupleForUser, type CoupleWithMembers } from "@/lib/couples";

export type SessionUser = typeof auth.$Infer.Session.user;

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export async function requireCouple(): Promise<{ user: SessionUser; couple: CoupleWithMembers }> {
  const user = await requireUser();
  const couple = await getCoupleForUser(user.id);
  if (!couple) redirect("/onboarding");
  return { user, couple };
}
