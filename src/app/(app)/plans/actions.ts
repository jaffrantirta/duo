"use server";

import { revalidatePath, updateTag } from "next/cache";
import { redirect } from "next/navigation";
import {
  createPlan,
  deletePlan,
  setPlanStatus,
  updatePlan,
  type PlanFieldErrors,
  type PlanStatus,
} from "@/lib/plans";
import { requireCouple } from "@/lib/session";

export type PlanFormState = {
  fieldErrors?: PlanFieldErrors;
  values?: { type: string; title: string; onDate: string; atTime: string };
};

function readPlanInput(formData: FormData) {
  return {
    type: String(formData.get("type") ?? ""),
    title: String(formData.get("title") ?? ""),
    onDate: String(formData.get("onDate") ?? ""),
    atTime: String(formData.get("atTime") ?? ""),
  };
}

function refresh(coupleId: string) {
  revalidatePath("/plans");
  revalidatePath("/home");
  updateTag(`plans-${coupleId}`);
}

export async function createPlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const { user, couple } = await requireCouple();
  const values = readPlanInput(formData);

  const result = await createPlan(couple.id, user.id, values);
  if (!result.ok) {
    return { fieldErrors: result.reason === "invalid_input" ? result.fieldErrors : {}, values };
  }

  refresh(couple.id);
  redirect("/plans");
}

export async function updatePlanAction(
  planId: string,
  _prev: PlanFormState,
  formData: FormData,
): Promise<PlanFormState> {
  const { couple } = await requireCouple();
  const values = readPlanInput(formData);

  const result = await updatePlan(couple.id, planId, values);
  if (!result.ok) {
    if (result.reason === "not_found") redirect("/plans");
    return { fieldErrors: result.fieldErrors, values };
  }

  refresh(couple.id);
  redirect("/plans");
}

export async function setPlanStatusAction(planId: string, status: PlanStatus): Promise<void> {
  const { couple } = await requireCouple();
  await setPlanStatus(couple.id, planId, status);
  refresh(couple.id);
  redirect("/plans");
}

export async function deletePlanAction(planId: string): Promise<void> {
  const { couple } = await requireCouple();
  await deletePlan(couple.id, planId);
  refresh(couple.id);
  redirect("/plans");
}
