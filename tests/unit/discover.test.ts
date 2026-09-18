import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleMembers, discoverCards, discoverSwipes, plans } from "@/db/schema";
import { addCard, getNextCard, swipeCard } from "@/lib/discover";
import { createTestCouple, createTestUser, resetDb } from "../helpers/db";

async function twoPartnerCouple() {
  const a = await createTestUser({ name: "A" });
  const b = await createTestUser({ name: "B" });
  const coupleId = await createTestCouple(a.id);
  await db.insert(coupleMembers).values({ coupleId, userId: b.id });
  return { coupleId, aId: a.id, bId: b.id };
}

async function insertCard(
  coupleId: string | null,
  overrides: Partial<{ type: string; title: string; description: string }> = {},
) {
  const [card] = await db
    .insert(discoverCards)
    .values({
      coupleId,
      type: overrides.type ?? "dinner",
      title: overrides.title ?? "Try a new restaurant",
      description: overrides.description ?? "Pick a place neither of you has been to.",
    })
    .returning();
  return card;
}

describe("getNextCard", () => {
  beforeEach(resetDb);

  it("returns a global card", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const card = await insertCard(null);

    expect(await getNextCard(coupleId, aId)).toEqual({
      id: card.id,
      type: card.type,
      title: card.title,
      description: card.description,
    });
  });

  it("returns the couple's own custom card but not another couple's", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const other = await createTestUser();
    const otherCoupleId = await createTestCouple(other.id);
    await insertCard(otherCoupleId, { title: "Someone else's idea" });
    await insertCard(coupleId, { title: "Our idea" });

    expect((await getNextCard(coupleId, aId))?.title).toBe("Our idea");
  });

  it("skips a card the user already swiped", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const card = await insertCard(null);
    await db.insert(discoverSwipes).values({ cardId: card.id, userId: aId, decision: true });

    expect(await getNextCard(coupleId, aId)).toBeNull();
  });

  it("returns null when the deck is empty", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    expect(await getNextCard(coupleId, aId)).toBeNull();
  });

  it("orders by oldest card first", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const first = await insertCard(null, { title: "First" });
    await new Promise((resolve) => setTimeout(resolve, 10));
    await insertCard(null, { title: "Second" });

    expect((await getNextCard(coupleId, aId))?.id).toBe(first.id);
  });
});

describe("addCard", () => {
  beforeEach(resetDb);

  it("creates the card scoped to the couple and records the creator's yes", async () => {
    const { coupleId, aId } = await twoPartnerCouple();

    const result = await addCard(coupleId, aId, { type: "dinner", title: "Picnic", description: "Anywhere outside." });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.card.title).toBe("Picnic");
    const [row] = await db.select().from(discoverCards).where(eq(discoverCards.id, result.card.id));
    expect(row.coupleId).toBe(coupleId);
    const swipes = await db.select().from(discoverSwipes).where(eq(discoverSwipes.cardId, result.card.id));
    expect(swipes).toEqual([expect.objectContaining({ userId: aId, decision: true })]);
  });

  it("rejects an invalid type", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const result = await addCard(coupleId, aId, { type: "not-a-type", title: "Picnic", description: "Anywhere outside." });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.type).toBe("Pick a type");
  });

  it("rejects a blank description", async () => {
    const { coupleId, aId } = await twoPartnerCouple();
    const result = await addCard(coupleId, aId, { type: "dinner", title: "Picnic", description: "   " });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fieldErrors.description).toBe("Say a bit more");
  });

  it("makes the new card visible to the other partner but not the creator", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const result = await addCard(coupleId, aId, { type: "dinner", title: "Picnic", description: "Anywhere outside." });
    if (!result.ok) return;

    expect(await getNextCard(coupleId, aId)).toBeNull();
    expect((await getNextCard(coupleId, bId))?.title).toBe("Picnic");
  });
});

describe("swipeCard", () => {
  beforeEach(resetDb);

  it("records a lone yes without matching", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const card = await insertCard(null);

    const result = await swipeCard(coupleId, aId, bId, card.id, true);

    expect(result).toEqual({ ok: true, match: false });
    expect(await db.select().from(plans).where(eq(plans.coupleId, coupleId))).toHaveLength(0);
  });

  it("matches and creates a plan when both partners say yes", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const card = await insertCard(null, { type: "movie", title: "Rewatch your first movie" });
    await swipeCard(coupleId, aId, bId, card.id, true);

    const result = await swipeCard(coupleId, bId, aId, card.id, true);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.match).toBe(true);
    expect(result.plan?.title).toBe("Rewatch your first movie");
    expect(result.plan?.type).toBe("movie");
    expect(result.plan?.status).toBe("idea");
    expect(await db.select().from(plans).where(eq(plans.coupleId, coupleId))).toHaveLength(1);
  });

  it("never matches on a no", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const card = await insertCard(null);
    await swipeCard(coupleId, aId, bId, card.id, true);

    const result = await swipeCard(coupleId, bId, aId, card.id, false);

    expect(result).toEqual({ ok: true, match: false });
    expect(await db.select().from(plans).where(eq(plans.coupleId, coupleId))).toHaveLength(0);
  });

  it("is idempotent on a re-swipe by the same person", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const card = await insertCard(null);
    await swipeCard(coupleId, aId, bId, card.id, true);
    await swipeCard(coupleId, bId, aId, card.id, true);

    const result = await swipeCard(coupleId, aId, bId, card.id, true);

    expect(result).toEqual({ ok: true, match: false });
    expect(await db.select().from(plans).where(eq(plans.coupleId, coupleId))).toHaveLength(1);
  });

  it("lets a solo couple swipe without a partner", async () => {
    const solo = await createTestUser();
    const coupleId = await createTestCouple(solo.id);
    const card = await insertCard(null);

    const result = await swipeCard(coupleId, solo.id, null, card.id, true);

    expect(result).toEqual({ ok: true, match: false });
  });

  it("returns not_found for a card belonging to a different couple", async () => {
    const { coupleId, aId, bId } = await twoPartnerCouple();
    const other = await createTestUser();
    const otherCoupleId = await createTestCouple(other.id);
    const card = await insertCard(otherCoupleId);

    const result = await swipeCard(coupleId, aId, bId, card.id, true);

    expect(result).toEqual({ ok: false, reason: "not_found" });
  });
});
