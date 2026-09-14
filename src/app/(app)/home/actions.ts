"use server";

import { count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { coupleMembers, couples } from "@/db/schema";
import { createInvite } from "@/lib/invites";
import { requireCouple } from "@/lib/session";

export async function regenerateInviteAction(): Promise<void> {
  const { user, couple } = await requireCouple();
  if (couple.members.length >= 2) return;

  await db.transaction(async (tx) => {
    await tx.select({ id: couples.id }).from(couples).where(eq(couples.id, couple.id)).for("update");
    const [members] = await tx
      .select({ value: count() })
      .from(coupleMembers)
      .where(eq(coupleMembers.coupleId, couple.id));
    if (members.value >= 2) return;
    await createInvite(tx, { coupleId: couple.id, createdBy: user.id });
  });

  revalidatePath("/home");
}
