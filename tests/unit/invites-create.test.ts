import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { coupleInvites } from "@/db/schema";
import { INVITE_TTL_MS, createInvite, getActiveInvite, inviteUrl } from "@/lib/invites";
import { createTestCouple, createTestUser, resetDb } from "../helpers/db";

describe("createInvite", () => {
  beforeEach(resetDb);

  it("creates a URL-safe token that expires in 7 days", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);
    const now = new Date("2026-09-13T10:00:00Z");

    const invite = await createInvite(db, { coupleId, createdBy: inviter.id, now });

    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invite.expiresAt.getTime()).toBe(now.getTime() + INVITE_TTL_MS);
    expect(invite.usedAt).toBeNull();
    expect(invite.revokedAt).toBeNull();
  });

  it("revokes the previous open invite", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);

    const first = await createInvite(db, { coupleId, createdBy: inviter.id });
    const second = await createInvite(db, { coupleId, createdBy: inviter.id });

    const [firstRow] = await db.select().from(coupleInvites).where(eq(coupleInvites.id, first.id));
    expect(firstRow.revokedAt).not.toBeNull();
    expect((await getActiveInvite(coupleId))?.id).toBe(second.id);
  });
});

describe("getActiveInvite", () => {
  beforeEach(resetDb);

  it("ignores expired invites", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);
    await createInvite(db, {
      coupleId,
      createdBy: inviter.id,
      now: new Date(Date.now() - INVITE_TTL_MS - 60_000),
    });

    expect(await getActiveInvite(coupleId)).toBeNull();
  });
});

describe("inviteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds an absolute link from BETTER_AUTH_URL", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://duo.example/");
    expect(inviteUrl("abc")).toBe("https://duo.example/invite/abc");
  });
});
