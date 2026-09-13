import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { coupleInvites } from "@/db/schema";
import { appUrl } from "@/lib/app-url";

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
