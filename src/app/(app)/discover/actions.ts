"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { swipeCard } from "@/lib/discover";
import { requireCouple } from "@/lib/session";

export async function swipeCardAction(cardId: string, decision: boolean): Promise<void> {
  const { user, couple } = await requireCouple();
  const partnerId = couple.members.find((member) => member.id !== user.id)?.id ?? null;
  const result = await swipeCard(couple.id, user.id, partnerId, cardId, decision);

  if (result.ok && result.match) {
    revalidatePath("/plans");
    revalidatePath("/home");
    updateTag(`plans-${couple.id}`);
    redirect("/discover?matched=1");
  }
  redirect("/discover");
}
