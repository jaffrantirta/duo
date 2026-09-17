"use server";

import { joinWaitlist } from "@/lib/waitlist";

export type WaitlistFormState = { done?: boolean; error?: string };

export async function joinWaitlistAction(
  _prev: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await joinWaitlist(email);

  if (!result.ok) return { error: result.error };
  return { done: true };
}
