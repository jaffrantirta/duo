"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { createInvite } from "@/lib/invites";
import { requireCouple } from "@/lib/session";

export async function regenerateInviteAction(): Promise<void> {
  const { user, couple } = await requireCouple();
  if (couple.members.length >= 2) return;
  await createInvite(db, { coupleId: couple.id, createdBy: user.id });
  revalidatePath("/home");
}
