import { and, asc, eq, gte, isNotNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { plans } from "@/db/schema";
import { planDateSchema, planTimeSchema, planTitleSchema, planTypeSchema } from "@/lib/validation";

export type PlanStatus = "idea" | "planned" | "done";

export type Plan = typeof plans.$inferSelect;

export type PlanInput = { type: string; title: string; onDate: string; atTime: string };

export type PlanFieldErrors = { type?: string; title?: string; onDate?: string; atTime?: string };

export type PlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: "invalid_input"; fieldErrors: PlanFieldErrors }
  | { ok: false; reason: "not_found" };

const planSchema = z.object({
  type: planTypeSchema,
  title: planTitleSchema,
  onDate: z.union([z.literal(""), planDateSchema]),
  atTime: z.union([z.literal(""), planTimeSchema]),
});

type ParsedPlan = { type: string; title: string; onDate: string | null; atTime: string | null };

function parsePlanInput(input: PlanInput): { ok: true; value: ParsedPlan } | { ok: false; fieldErrors: PlanFieldErrors } {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      fieldErrors: {
        type: errors.type?.[0],
        title: errors.title?.[0],
        onDate: errors.onDate?.[0],
        atTime: errors.atTime?.[0],
      },
    };
  }

  const { type, title, onDate, atTime } = parsed.data;
  if (atTime && !onDate) {
    return { ok: false, fieldErrors: { atTime: "Pick a date for this time" } };
  }
  return { ok: true, value: { type, title, onDate: onDate || null, atTime: atTime || null } };
}

// Postgres hands back HH:MM:SS; everything above this module works in HH:MM.
function toPlan(row: Plan): Plan {
  return row.atTime ? { ...row, atTime: row.atTime.slice(0, 5) } : row;
}

export async function createPlan(coupleId: string, userId: string, input: PlanInput): Promise<PlanResult> {
  const parsed = parsePlanInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid_input", fieldErrors: parsed.fieldErrors };

  const { type, title, onDate, atTime } = parsed.value;
  const [row] = await db
    .insert(plans)
    .values({ coupleId, createdBy: userId, type, title, onDate, atTime, status: onDate ? "planned" : "idea" })
    .returning();

  return { ok: true, plan: toPlan(row) };
}

export async function getPlan(coupleId: string, planId: string): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(plans)
    .where(and(eq(plans.id, planId), eq(plans.coupleId, coupleId)))
    .limit(1);
  return row ? toPlan(row) : null;
}

export async function updatePlan(coupleId: string, planId: string, input: PlanInput): Promise<PlanResult> {
  const parsed = parsePlanInput(input);
  if (!parsed.ok) return { ok: false, reason: "invalid_input", fieldErrors: parsed.fieldErrors };

  const { type, title, onDate, atTime } = parsed.value;
  const [row] = await db
    .update(plans)
    .set({ type, title, onDate, atTime })
    .where(and(eq(plans.id, planId), eq(plans.coupleId, coupleId)))
    .returning();

  return row ? { ok: true, plan: toPlan(row) } : { ok: false, reason: "not_found" };
}

export async function setPlanStatus(coupleId: string, planId: string, status: PlanStatus): Promise<PlanResult> {
  if (!["idea", "planned", "done"].includes(status)) return { ok: false, reason: "not_found" };

  const [row] = await db
    .update(plans)
    .set({ status })
    .where(and(eq(plans.id, planId), eq(plans.coupleId, coupleId)))
    .returning();

  return row ? { ok: true, plan: toPlan(row) } : { ok: false, reason: "not_found" };
}

export async function deletePlan(coupleId: string, planId: string): Promise<{ ok: boolean }> {
  const rows = await db
    .delete(plans)
    .where(and(eq(plans.id, planId), eq(plans.coupleId, coupleId)))
    .returning({ id: plans.id });

  return { ok: rows.length > 0 };
}

export async function listPlans(coupleId: string): Promise<{ idea: Plan[]; planned: Plan[]; done: Plan[] }> {
  // ponytail: one query, grouped and sorted in JS. A couple has tens of plans, not thousands;
  // move to per-status SQL queries if that ever stops being true.
  const rows = await db.select().from(plans).where(eq(plans.coupleId, coupleId));
  const all = rows.map(toPlan);
  const newestFirst = (a: Plan, b: Plan) => b.createdAt.getTime() - a.createdAt.getTime();

  return {
    planned: all
      .filter((plan) => plan.status === "planned")
      .sort((a, b) => {
        if (a.onDate && b.onDate) return a.onDate.localeCompare(b.onDate) || newestFirst(a, b);
        if (a.onDate) return -1;
        if (b.onDate) return 1;
        return newestFirst(a, b);
      }),
    idea: all.filter((plan) => plan.status === "idea").sort(newestFirst),
    done: all.filter((plan) => plan.status === "done").sort(newestFirst),
  };
}

export async function getNextPlan(coupleId: string, today: string): Promise<Plan | null> {
  const [row] = await db
    .select()
    .from(plans)
    .where(
      and(
        eq(plans.coupleId, coupleId),
        eq(plans.status, "planned"),
        isNotNull(plans.onDate),
        gte(plans.onDate, today),
      ),
    )
    .orderBy(asc(plans.onDate), sql`${plans.atTime} asc nulls last`)
    .limit(1);

  return row ? toPlan(row) : null;
}
