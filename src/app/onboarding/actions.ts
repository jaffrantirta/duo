"use server";

import { redirect } from "next/navigation";
import { createCouple } from "@/lib/couples";
import { requireUser } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export type OnboardingState = {
  fieldErrors?: { name?: string; togetherSince?: string };
  values?: { name: string; togetherSince: string };
};

export async function createCoupleAction(_prev: OnboardingState, formData: FormData): Promise<OnboardingState> {
  const user = await requireUser();
  const values = {
    name: String(formData.get("name") ?? ""),
    togetherSince: String(formData.get("togetherSince") ?? ""),
  };

  const result = await createCouple(user.id, values, await getViewerTimeZone());

  if (result.ok || result.reason === "already_in_couple") redirect("/home");
  return { fieldErrors: result.fieldErrors, values };
}
