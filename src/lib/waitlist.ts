import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { waitlist } from "@/db/schema";
import { waitlistEmailSchema } from "@/lib/validation";

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  const parsed = waitlistEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  try {
    await db.insert(waitlist).values({ email: parsed.data });
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true };
    throw err;
  }
}
