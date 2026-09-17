import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { coupleMembers, couples, user } from "@/db/schema";
import { todayInTimeZone } from "@/lib/dates";
import { createInvite } from "@/lib/invites";
import { nameSchema, togetherSinceSchema } from "@/lib/validation";

export type CreateCoupleInput = { name: string; togetherSince: string };

export type CreateCoupleResult =
  | { ok: true; coupleId: string }
  | { ok: false; reason: "invalid_input"; fieldErrors: { name?: string; togetherSince?: string } }
  | { ok: false; reason: "already_in_couple" };

export type CoupleMember = { id: string; name: string; image: string | null };

export type CoupleWithMembers = { id: string; togetherSince: string; members: CoupleMember[] };

const createCoupleSchema = z.object({ name: nameSchema, togetherSince: togetherSinceSchema });

export async function createCouple(
  userId: string,
  input: CreateCoupleInput,
  timeZone: string,
): Promise<CreateCoupleResult> {
  const parsed = createCoupleSchema.safeParse(input);
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      reason: "invalid_input",
      fieldErrors: { name: errors.name?.[0], togetherSince: errors.togetherSince?.[0] },
    };
  }

  const { name, togetherSince } = parsed.data;
  if (togetherSince > todayInTimeZone(timeZone)) {
    return { ok: false, reason: "invalid_input", fieldErrors: { togetherSince: "That date is in the future" } };
  }

  try {
    const coupleId = await db.transaction(async (tx) => {
      await tx.update(user).set({ name }).where(eq(user.id, userId));
      const [couple] = await tx.insert(couples).values({ togetherSince }).returning({ id: couples.id });
      await tx.insert(coupleMembers).values({ coupleId: couple.id, userId });
      await createInvite(tx, { coupleId: couple.id, createdBy: userId });
      return couple.id;
    });
    return { ok: true, coupleId };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "already_in_couple" };
    throw err;
  }
}

// Uncached: a single indexed lookup, already fast, and it's the function that decides
// whether the (cached) join query below even needs to run.
export async function findCoupleIdForUser(userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return membership?.coupleId ?? null;
}

// Uncached, keyed by coupleId (not userId) so both partners share one cache entry above.
export async function getCoupleById(coupleId: string): Promise<CoupleWithMembers | null> {
  const rows = await db
    .select({
      coupleId: couples.id,
      togetherSince: couples.togetherSince,
      memberId: user.id,
      memberName: user.name,
      memberImage: user.image,
    })
    .from(couples)
    .innerJoin(coupleMembers, eq(coupleMembers.coupleId, couples.id))
    .innerJoin(user, eq(user.id, coupleMembers.userId))
    .where(eq(couples.id, coupleId))
    .orderBy(asc(coupleMembers.joinedAt));

  if (rows.length === 0) return null;

  return {
    id: rows[0].coupleId,
    togetherSince: rows[0].togetherSince,
    members: rows.map((row) => ({ id: row.memberId, name: row.memberName, image: row.memberImage })),
  };
}

export async function getCoupleForUser(userId: string): Promise<CoupleWithMembers | null> {
  const coupleId = await findCoupleIdForUser(userId);
  if (!coupleId) return null;
  return getCoupleById(coupleId);
}

// unstable_cache throws outside a real Next.js request, so this must never be called
// from a Vitest test — only from src/lib/session.ts, which is already server-only.
export function getCachedCoupleById(coupleId: string): Promise<CoupleWithMembers | null> {
  return unstable_cache(() => getCoupleById(coupleId), ["couple-by-id", coupleId], {
    tags: [`couple-${coupleId}`],
  })();
}
