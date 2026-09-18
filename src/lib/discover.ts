import { and, asc, eq, isNull, notInArray, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { discoverCards, discoverSwipes, plans } from "@/db/schema";
import type { Plan } from "@/lib/plans";
import { discoverCardDescriptionSchema, planTitleSchema, planTypeSchema } from "@/lib/validation";

export type DiscoverCard = { id: string; type: string; title: string; description: string };

export type AddCardInput = { type: string; title: string; description: string };
export type AddCardFieldErrors = { type?: string; title?: string; description?: string };
export type AddCardResult = { ok: true; card: DiscoverCard } | { ok: false; fieldErrors: AddCardFieldErrors };

export type SwipeResult = { ok: true; match: boolean; plan?: Plan } | { ok: false; reason: "not_found" };

const addCardSchema = z.object({
  type: planTypeSchema,
  title: planTitleSchema,
  description: discoverCardDescriptionSchema,
});

function toCard(row: typeof discoverCards.$inferSelect): DiscoverCard {
  return { id: row.id, type: row.type, title: row.title, description: row.description };
}

export async function getNextCard(coupleId: string, userId: string): Promise<DiscoverCard | null> {
  const swiped = await db.select({ id: discoverSwipes.cardId }).from(discoverSwipes).where(eq(discoverSwipes.userId, userId));
  const swipedIds = swiped.map((row) => row.id);

  const [row] = await db
    .select()
    .from(discoverCards)
    .where(
      and(
        or(isNull(discoverCards.coupleId), eq(discoverCards.coupleId, coupleId)),
        swipedIds.length > 0 ? notInArray(discoverCards.id, swipedIds) : undefined,
      ),
    )
    .orderBy(sql`${discoverCards.coupleId} is null`, asc(discoverCards.createdAt), asc(discoverCards.id))
    .limit(1);

  return row ? toCard(row) : null;
}

export async function addCard(coupleId: string, userId: string, input: AddCardInput): Promise<AddCardResult> {
  const parsed = addCardSchema.safeParse(input);
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      fieldErrors: { type: errors.type?.[0], title: errors.title?.[0], description: errors.description?.[0] },
    };
  }

  const { type, title, description } = parsed.data;
  const card = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(discoverCards)
      .values({ coupleId, type, title, description, createdBy: userId })
      .returning();
    await tx.insert(discoverSwipes).values({ cardId: row.id, userId, decision: true });
    return row;
  });

  return { ok: true, card: toCard(card) };
}

export async function swipeCard(
  coupleId: string,
  userId: string,
  partnerId: string | null,
  cardId: string,
  decision: boolean,
): Promise<SwipeResult> {
  const [card] = await db
    .select()
    .from(discoverCards)
    .where(and(eq(discoverCards.id, cardId), or(isNull(discoverCards.coupleId), eq(discoverCards.coupleId, coupleId))))
    .limit(1);
  if (!card) return { ok: false, reason: "not_found" };

  try {
    await db.insert(discoverSwipes).values({ cardId, userId, decision });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true, match: false };
    throw err;
  }

  if (!decision || !partnerId) return { ok: true, match: false };

  const [partnerYes] = await db
    .select()
    .from(discoverSwipes)
    .where(and(eq(discoverSwipes.cardId, cardId), eq(discoverSwipes.userId, partnerId), eq(discoverSwipes.decision, true)))
    .limit(1);
  if (!partnerYes) return { ok: true, match: false };

  // ponytail: two "yes" swipes on the same card at the exact same instant could each pass this
  // check before either's plan insert commits, creating two plans for one match. A couple is two
  // people tapping one card — if this is ever observed, guard the check-then-insert with
  // pg_advisory_xact_lock(hashtext(cardId)) inside a transaction.
  const [plan] = await db
    .insert(plans)
    .values({ coupleId, type: card.type, title: card.title, status: "idea", createdBy: userId })
    .returning();
  return { ok: true, match: true, plan };
}
