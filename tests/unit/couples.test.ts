import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleMembers, user } from "@/db/schema";
import { createCouple, getCoupleForUser } from "@/lib/couples";
import { getActiveInvite } from "@/lib/invites";
import { createTestUser, resetDb } from "../helpers/db";

describe("createCouple", () => {
  beforeEach(resetDb);

  it("creates the couple, adds the user, sets their name and opens an invite", async () => {
    const me = await createTestUser();

    const result = await createCouple(me.id, { name: "  Jaffran  ", togetherSince: "2024-05-10" }, "UTC");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const couple = await getCoupleForUser(me.id);
    expect(couple).toEqual({
      id: result.coupleId,
      togetherSince: "2024-05-10",
      members: [{ id: me.id, name: "Jaffran", image: null }],
    });
    expect(await getActiveInvite(result.coupleId)).not.toBeNull();
  });

  it("rejects a blank name", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "   ", togetherSince: "2024-05-10" }, "UTC");
    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      fieldErrors: { name: "Tell us what to call you", togetherSince: undefined },
    });
  });

  it("rejects a name longer than 40 characters", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "a".repeat(41), togetherSince: "2024-05-10" }, "UTC");
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.name).toBe(
      "Keep it under 40 characters",
    );
  });

  it("rejects an invalid date", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "Jaffran", togetherSince: "not-a-date" }, "UTC");
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.togetherSince).toBe(
      "Pick a valid date",
    );
  });

  it("rejects a date in the future", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "Jaffran", togetherSince: "2999-01-01" }, "UTC");
    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      fieldErrors: { togetherSince: "That date is in the future" },
    });
  });

  it("refuses a user who is already in a couple and leaves their data unchanged", async () => {
    const me = await createTestUser();
    await createCouple(me.id, { name: "Jaffran", togetherSince: "2024-05-10" }, "UTC");

    const second = await createCouple(me.id, { name: "Someone Else", togetherSince: "2025-01-01" }, "UTC");

    expect(second).toEqual({ ok: false, reason: "already_in_couple" });
    const [row] = await db.select().from(user).where(eq(user.id, me.id));
    expect(row.name).toBe("Jaffran");
    expect(await db.select().from(coupleMembers)).toHaveLength(1);
  });
});

describe("getCoupleForUser", () => {
  beforeEach(resetDb);

  it("returns null for a user without a couple", async () => {
    const me = await createTestUser();
    expect(await getCoupleForUser(me.id)).toBeNull();
  });

  it("lists members in the order they joined", async () => {
    const first = await createTestUser({ name: "Jaffran" });
    const second = await createTestUser({ name: "Sarah" });
    const result = await createCouple(first.id, { name: "Jaffran", togetherSince: "2024-05-10" }, "UTC");
    if (!result.ok) throw new Error("setup failed");
    await db.insert(coupleMembers).values({ coupleId: result.coupleId, userId: second.id });

    const couple = await getCoupleForUser(second.id);

    expect(couple?.members.map((m) => m.name)).toEqual(["Jaffran", "Sarah"]);
  });
});
