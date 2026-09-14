import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleInvites, coupleMembers, couples, user } from "@/db/schema";
import { createCouple, getCoupleForUser } from "@/lib/couples";
import {
  INVITE_TTL_MS,
  acceptInvite,
  createInvite,
  getActiveInvite,
  getInvitePreview,
  getInviteView,
} from "@/lib/invites";
import { createTestUser, resetDb } from "../helpers/db";

async function coupleWithInvite(inviterName = "Jaffran") {
  const inviter = await createTestUser();
  const result = await createCouple(inviter.id, { name: inviterName, togetherSince: "2024-05-10" }, "UTC");
  if (!result.ok) throw new Error("setup failed");
  const invite = await getActiveInvite(result.coupleId);
  if (!invite) throw new Error("setup failed: no invite");
  return { inviter, coupleId: result.coupleId, invite };
}

describe("getInvitePreview", () => {
  beforeEach(resetDb);

  it("returns the inviter's name for a known invite", async () => {
    const { invite } = await coupleWithInvite();
    expect(await getInvitePreview(invite.token)).toEqual({ inviterName: "Jaffran" });
  });

  it("returns null for unknown or malformed tokens", async () => {
    expect(await getInvitePreview("x".repeat(43))).toBeNull();
    expect(await getInvitePreview("../../etc")).toBeNull();
  });
});

describe("getInviteView", () => {
  beforeEach(resetDb);

  it("is ok for a fresh invite and a user without a couple", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    expect(await getInviteView(invite.token, partner.id)).toEqual({ ok: true, inviterName: "Jaffran" });
  });

  it("reports not_found for unknown and revoked invites", async () => {
    const { inviter, coupleId, invite } = await coupleWithInvite();
    const partner = await createTestUser();
    expect(await getInviteView("x".repeat(43), partner.id)).toEqual({ ok: false, reason: "not_found" });

    await createInvite(db, { coupleId, createdBy: inviter.id });
    expect(await getInviteView(invite.token, partner.id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports own_invite to the inviter", async () => {
    const { inviter, invite } = await coupleWithInvite();
    expect(await getInviteView(invite.token, inviter.id)).toEqual({ ok: false, reason: "own_invite" });
  });

  it("reports expired after 7 days", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    const later = new Date(invite.expiresAt.getTime() + 1);
    expect(await getInviteView(invite.token, partner.id, later)).toEqual({ ok: false, reason: "expired" });
  });

  it("reports used once someone has joined", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    const stranger = await createTestUser();
    await acceptInvite(invite.token, { userId: partner.id, name: "Sarah" });
    expect(await getInviteView(invite.token, stranger.id)).toEqual({ ok: false, reason: "used" });
  });

  it("is ok for a visitor who is alone in their own couple", async () => {
    const { invite } = await coupleWithInvite();
    const solo = await coupleWithInvite("Solo");
    expect(await getInviteView(invite.token, solo.inviter.id)).toEqual({ ok: true, inviterName: "Jaffran" });
  });

  it("reports already_paired when the visitor's couple has two members", async () => {
    const { invite } = await coupleWithInvite();
    const other = await coupleWithInvite("Other");
    const otherPartner = await createTestUser();
    await db.insert(coupleMembers).values({ coupleId: other.coupleId, userId: otherPartner.id });
    expect(await getInviteView(invite.token, other.inviter.id)).toEqual({ ok: false, reason: "already_paired" });
  });

  it("reports couple_full when the couple already has two members", async () => {
    const { inviter, coupleId } = await coupleWithInvite();
    const partner = await createTestUser();
    await db.insert(coupleMembers).values({ coupleId, userId: partner.id });
    const extra = await createInvite(db, { coupleId, createdBy: inviter.id });
    const stranger = await createTestUser();
    expect(await getInviteView(extra.token, stranger.id)).toEqual({ ok: false, reason: "couple_full" });
  });
});

describe("acceptInvite", () => {
  beforeEach(resetDb);

  it("joins the couple, marks the invite used and saves the name", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, { userId: partner.id, name: " Sarah " });

    expect(result).toEqual({ ok: true, coupleId });
    const couple = await getCoupleForUser(partner.id);
    expect(couple?.members.map((m) => m.name)).toEqual(["Jaffran", "Sarah"]);
    const [inviteRow] = await db.select().from(coupleInvites).where(eq(coupleInvites.id, invite.id));
    expect(inviteRow.usedAt).not.toBeNull();
  });

  it("rejects an invalid name without joining", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, { userId: partner.id, name: "" });

    expect(result).toEqual({ ok: false, reason: "invalid_name", message: "Tell us what to call you" });
    expect(await getCoupleForUser(partner.id)).toBeNull();
  });

  it("re-checks expiry at accept time", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, {
      userId: partner.id,
      name: "Sarah",
      now: new Date(Date.now() + INVITE_TTL_MS + 60_000),
    });

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(await getCoupleForUser(partner.id)).toBeNull();
  });

  it("moves a user who is alone in their own couple and removes that couple", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const solo = await coupleWithInvite("Sarah");

    const result = await acceptInvite(invite.token, { userId: solo.inviter.id, name: "Sarah" });

    expect(result).toEqual({ ok: true, coupleId });
    expect(await db.select().from(couples).where(eq(couples.id, solo.coupleId))).toHaveLength(0);
    expect(await db.select().from(coupleInvites).where(eq(coupleInvites.coupleId, solo.coupleId))).toHaveLength(0);
    const couple = await getCoupleForUser(solo.inviter.id);
    expect(couple?.id).toBe(coupleId);
    expect(couple?.members.map((m) => m.name)).toEqual(["Jaffran", "Sarah"]);
  });

  it("reports already_paired for a user whose couple has two members and changes nothing", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const other = await coupleWithInvite("Other");
    const otherPartner = await createTestUser();
    await db.insert(coupleMembers).values({ coupleId: other.coupleId, userId: otherPartner.id });

    const result = await acceptInvite(invite.token, { userId: other.inviter.id, name: "Renamed" });

    expect(result).toEqual({ ok: false, reason: "already_paired" });
    expect((await getCoupleForUser(other.inviter.id))?.id).toBe(other.coupleId);
    expect(await db.select().from(coupleMembers).where(eq(coupleMembers.coupleId, coupleId))).toHaveLength(1);
    expect(await db.select().from(coupleMembers).where(eq(coupleMembers.coupleId, other.coupleId))).toHaveLength(2);
    const [inviteRow] = await db.select().from(coupleInvites).where(eq(coupleInvites.id, invite.id));
    expect(inviteRow.usedAt).toBeNull();
    const [row] = await db.select().from(user).where(eq(user.id, other.inviter.id));
    expect(row.name).toBe("Other");
  });

  it("lets exactly one of two people accept the same invite at once", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const first = await createTestUser();
    const second = await createTestUser();

    const results = await Promise.all([
      acceptInvite(invite.token, { userId: first.id, name: "First" }),
      acceptInvite(invite.token, { userId: second.id, name: "Second" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "used" }]);
    const members = await db.select().from(coupleMembers).where(eq(coupleMembers.coupleId, coupleId));
    expect(members).toHaveLength(2);
  });

  it("lets one person join only one of two couples at once", async () => {
    const a = await coupleWithInvite("A");
    const b = await coupleWithInvite("B");
    const partner = await createTestUser();

    const results = await Promise.all([
      acceptInvite(a.invite.token, { userId: partner.id, name: "Sarah" }),
      acceptInvite(b.invite.token, { userId: partner.id, name: "Sarah" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "already_paired" }]);
    const [row] = await db.select().from(user).where(eq(user.id, partner.id));
    expect(row.name).toBe("Sarah");
  });
});
