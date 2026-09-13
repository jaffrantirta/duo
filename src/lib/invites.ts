import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { coupleInvites, coupleMembers, couples, user } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { nameSchema } from "@/lib/validation";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Invite = typeof coupleInvites.$inferSelect;

export async function createInvite(
  exec: DbExecutor,
  params: { coupleId: string; createdBy: string; now?: Date },
): Promise<Invite> {
  const now = params.now ?? new Date();

  await exec
    .update(coupleInvites)
    .set({ revokedAt: now })
    .where(
      and(
        eq(coupleInvites.coupleId, params.coupleId),
        isNull(coupleInvites.usedAt),
        isNull(coupleInvites.revokedAt),
      ),
    );

  const [invite] = await exec
    .insert(coupleInvites)
    .values({
      coupleId: params.coupleId,
      createdBy: params.createdBy,
      token: randomBytes(32).toString("base64url"),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      createdAt: now,
    })
    .returning();

  return invite;
}

export async function getActiveInvite(coupleId: string, now: Date = new Date()): Promise<Invite | null> {
  const [invite] = await db
    .select()
    .from(coupleInvites)
    .where(
      and(
        eq(coupleInvites.coupleId, coupleId),
        isNull(coupleInvites.usedAt),
        isNull(coupleInvites.revokedAt),
        gt(coupleInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(coupleInvites.createdAt))
    .limit(1);

  return invite ?? null;
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}

export type InviteProblem = "not_found" | "expired" | "used" | "own_invite" | "already_paired" | "couple_full";

export type InviteView = { ok: true; inviterName: string } | { ok: false; reason: InviteProblem };

export type AcceptInviteResult =
  | { ok: true; coupleId: string }
  | { ok: false; reason: InviteProblem }
  | { ok: false; reason: "invalid_name"; message: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

async function loadInvite(exec: DbExecutor, token: string) {
  const [row] = await exec
    .select({ invite: coupleInvites, inviterName: user.name })
    .from(coupleInvites)
    .innerJoin(user, eq(user.id, coupleInvites.createdBy))
    .where(eq(coupleInvites.token, token))
    .limit(1);
  return row ?? null;
}

async function countMembers(exec: DbExecutor, coupleId: string): Promise<number> {
  const [row] = await exec
    .select({ value: count() })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, coupleId));
  return row.value;
}

async function findCoupleIdForUser(exec: DbExecutor, userId: string): Promise<string | null> {
  const [row] = await exec
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return row?.coupleId ?? null;
}

async function findProblem(
  exec: DbExecutor,
  invite: Invite | null,
  userId: string,
  now: Date,
): Promise<InviteProblem | null> {
  if (!invite || invite.revokedAt) return "not_found";
  if (invite.createdBy === userId) return "own_invite";
  if (invite.usedAt) return "used";
  if (invite.expiresAt <= now) return "expired";
  if (await findCoupleIdForUser(exec, userId)) return "already_paired";
  if ((await countMembers(exec, invite.coupleId)) >= 2) return "couple_full";
  return null;
}

export async function getInvitePreview(token: string): Promise<{ inviterName: string } | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await loadInvite(db, token);
  if (!row || row.invite.revokedAt) return null;
  return { inviterName: row.inviterName };
}

export async function getInviteView(token: string, userId: string, now: Date = new Date()): Promise<InviteView> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "not_found" };
  const row = await loadInvite(db, token);
  const problem = await findProblem(db, row?.invite ?? null, userId, now);
  if (problem || !row) return { ok: false, reason: problem ?? "not_found" };
  return { ok: true, inviterName: row.inviterName };
}

export async function acceptInvite(
  token: string,
  params: { userId: string; name: string; now?: Date },
): Promise<AcceptInviteResult> {
  const name = nameSchema.safeParse(params.name);
  if (!name.success) {
    return { ok: false, reason: "invalid_name", message: name.error.issues[0]?.message ?? "Invalid name" };
  }
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "not_found" };
  const now = params.now ?? new Date();

  try {
    return await db.transaction(async (tx): Promise<AcceptInviteResult> => {
      const initial = await loadInvite(tx, token);
      if (!initial) return { ok: false, reason: "not_found" };

      // Serialize accepts per couple, then re-read so a concurrent accept's used_at is visible.
      await tx.select({ id: couples.id }).from(couples).where(eq(couples.id, initial.invite.coupleId)).for("update");
      const invite = (await loadInvite(tx, token))?.invite ?? null;

      const problem = await findProblem(tx, invite, params.userId, now);
      if (problem || !invite) return { ok: false, reason: problem ?? "not_found" };

      await tx.insert(coupleMembers).values({ coupleId: invite.coupleId, userId: params.userId });
      await tx.update(coupleInvites).set({ usedAt: now }).where(eq(coupleInvites.id, invite.id));
      await tx.update(user).set({ name: name.data }).where(eq(user.id, params.userId));
      return { ok: true, coupleId: invite.coupleId };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "already_paired" };
    throw err;
  }
}
