"use server";

import { redirect } from "next/navigation";
import { addCard, swipeCard, type AddCardFieldErrors } from "@/lib/discover";
import { refresh } from "@/lib/plans";
import { requireCouple } from "@/lib/session";

export async function swipeCardAction(cardId: string, decision: boolean): Promise<void> {
  const { user, couple } = await requireCouple();
  const partnerId = couple.members.find((member) => member.id !== user.id)?.id ?? null;
  const result = await swipeCard(couple.id, user.id, partnerId, cardId, decision);

  if (result.ok && result.match) {
    refresh(couple.id);
    redirect("/discover?matched=1");
  }
  redirect("/discover");
}

export type AddCardFormState = {
  fieldErrors?: AddCardFieldErrors;
  values?: { type: string; title: string; description: string };
};

export async function addCardAction(_prev: AddCardFormState, formData: FormData): Promise<AddCardFormState> {
  const { user, couple } = await requireCouple();
  const values = {
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    description: String(formData.get("description") ?? ""),
  };

  const result = await addCard(couple.id, user.id, values);
  if (!result.ok) return { fieldErrors: result.fieldErrors, values };

  redirect("/discover");
}
