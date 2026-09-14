"use server";

import { redirect } from "next/navigation";
import { acceptInvite, type InviteProblem } from "@/lib/invites";
import { requireUser } from "@/lib/session";

export type AcceptInviteState = { reason?: InviteProblem; nameError?: string; name?: string };

export async function acceptInviteAction(
  token: string,
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");

  const result = await acceptInvite(token, { userId: user.id, name });

  if (result.ok) redirect("/home");
  if (result.reason === "invalid_name") return { nameError: result.message, name };
  return { reason: result.reason };
}
