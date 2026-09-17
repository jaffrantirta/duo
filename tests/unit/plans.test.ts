import { beforeEach, describe, expect, it } from "vitest";
import {
  createPlan,
  deletePlan,
  getNextPlan,
  getPlan,
  listPlans,
  setPlanStatus,
  updatePlan,
} from "@/lib/plans";
import { createTestCouple, createTestUser, resetDb } from "../helpers/db";

const EMPTY = { onDate: "", atTime: "" };

async function couple() {
  const member = await createTestUser();
  const coupleId = await createTestCouple(member.id);
  return { userId: member.id, coupleId };
}

describe("createPlan", () => {
  beforeEach(resetDb);

  it("stores a dateless plan as an idea", async () => {
    const { coupleId, userId } = await couple();

    const result = await createPlan(coupleId, userId, { type: "movie", title: "  Interstellar  ", ...EMPTY });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.title).toBe("Interstellar");
    expect(result.plan.status).toBe("idea");
    expect(result.plan.onDate).toBeNull();
    expect(result.plan.atTime).toBeNull();
  });

  it("stores a dated plan as planned and returns HH:MM", async () => {
    const { coupleId, userId } = await couple();

    const result = await createPlan(coupleId, userId, {
      type: "dinner",
      title: "Ramen Danbo",
      onDate: "2026-10-03",
      atTime: "19:30",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.plan.status).toBe("planned");
    expect(result.plan.onDate).toBe("2026-10-03");
    expect(result.plan.atTime).toBe("19:30");
  });

  it("rejects a blank title", async () => {
    const { coupleId, userId } = await couple();
    const result = await createPlan(coupleId, userId, { type: "dinner", title: "   ", ...EMPTY });
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.title).toBe("Give it a name");
  });

  it("rejects an unknown type", async () => {
    const { coupleId, userId } = await couple();
    const result = await createPlan(coupleId, userId, { type: "spacewalk", title: "Moon", ...EMPTY });
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.type).toBe("Pick a type");
  });

  it("rejects a time with no date", async () => {
    const { coupleId, userId } = await couple();
    const result = await createPlan(coupleId, userId, { type: "dinner", title: "Ramen", onDate: "", atTime: "19:30" });
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.atTime).toBe(
      "Pick a date for this time",
    );
  });

  it("rejects an out-of-range time", async () => {
    const { coupleId, userId } = await couple();
    const result = await createPlan(coupleId, userId, {
      type: "dinner",
      title: "Ramen",
      onDate: "2026-10-03",
      atTime: "99:99",
    });
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.atTime).toBe(
      "Pick a valid time",
    );
  });
});

describe("getPlan, updatePlan, setPlanStatus, deletePlan", () => {
  beforeEach(resetDb);

  it("reads, edits and deletes a plan for its own couple", async () => {
    const { coupleId, userId } = await couple();
    const created = await createPlan(coupleId, userId, { type: "dinner", title: "Ramen", ...EMPTY });
    if (!created.ok) throw new Error("setup failed");
    const planId = created.plan.id;

    expect((await getPlan(coupleId, planId))?.title).toBe("Ramen");

    const updated = await updatePlan(coupleId, planId, {
      type: "movie",
      title: "Cinema",
      onDate: "2026-10-03",
      atTime: "",
    });
    expect(updated.ok && updated.plan.type).toBe("movie");
    expect(updated.ok && updated.plan.onDate).toBe("2026-10-03");

    expect((await deletePlan(coupleId, planId)).ok).toBe(true);
    expect(await getPlan(coupleId, planId)).toBeNull();
  });

  it("leaves status alone when editing", async () => {
    const { coupleId, userId } = await couple();
    const created = await createPlan(coupleId, userId, { type: "dinner", title: "Ramen", ...EMPTY });
    if (!created.ok) throw new Error("setup failed");

    const updated = await updatePlan(coupleId, created.plan.id, {
      type: "dinner",
      title: "Ramen",
      onDate: "2026-10-03",
      atTime: "",
    });

    expect(updated.ok && updated.plan.status).toBe("idea");
  });

  it("moves a plan through its statuses", async () => {
    const { coupleId, userId } = await couple();
    const created = await createPlan(coupleId, userId, { type: "dinner", title: "Ramen", ...EMPTY });
    if (!created.ok) throw new Error("setup failed");

    const done = await setPlanStatus(coupleId, created.plan.id, "done");

    expect(done.ok && done.plan.status).toBe("done");
  });

  it("refuses an unknown status", async () => {
    const { coupleId, userId } = await couple();
    const created = await createPlan(coupleId, userId, { type: "dinner", title: "Ramen", ...EMPTY });
    if (!created.ok) throw new Error("setup failed");

    const result = await setPlanStatus(coupleId, created.plan.id, "cancelled" as never);

    expect(result).toEqual({ ok: false, reason: "not_found" });
    expect((await getPlan(coupleId, created.plan.id))?.status).toBe("idea");
  });

  it("refuses every operation for another couple's plan", async () => {
    const mine = await couple();
    const theirs = await couple();
    const created = await createPlan(theirs.coupleId, theirs.userId, { type: "dinner", title: "Theirs", ...EMPTY });
    if (!created.ok) throw new Error("setup failed");
    const planId = created.plan.id;

    expect(await getPlan(mine.coupleId, planId)).toBeNull();
    expect(await updatePlan(mine.coupleId, planId, { type: "movie", title: "Mine", ...EMPTY })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(await setPlanStatus(mine.coupleId, planId, "done")).toEqual({ ok: false, reason: "not_found" });
    expect(await deletePlan(mine.coupleId, planId)).toEqual({ ok: false });
    expect((await getPlan(theirs.coupleId, planId))?.title).toBe("Theirs");
  });
});

describe("listPlans", () => {
  beforeEach(resetDb);

  it("groups by status, dates ascending, dateless planned last", async () => {
    const { coupleId, userId } = await couple();
    const make = async (title: string, onDate: string) =>
      createPlan(coupleId, userId, { type: "dinner", title, onDate, atTime: "" });

    await make("Later", "2026-11-01");
    await make("Sooner", "2026-10-01");
    const dateless = await createPlan(coupleId, userId, { type: "dinner", title: "Someday", ...EMPTY });
    if (!dateless.ok) throw new Error("setup failed");
    await setPlanStatus(coupleId, dateless.plan.id, "planned");
    await createPlan(coupleId, userId, { type: "movie", title: "An idea", ...EMPTY });
    const doneOne = await createPlan(coupleId, userId, { type: "movie", title: "Watched", ...EMPTY });
    if (!doneOne.ok) throw new Error("setup failed");
    await setPlanStatus(coupleId, doneOne.plan.id, "done");

    const { idea, planned, done } = await listPlans(coupleId);

    expect(planned.map((plan) => plan.title)).toEqual(["Sooner", "Later", "Someday"]);
    expect(idea.map((plan) => plan.title)).toEqual(["An idea"]);
    expect(done.map((plan) => plan.title)).toEqual(["Watched"]);
  });

  it("sees nothing from another couple", async () => {
    const mine = await couple();
    const theirs = await couple();
    await createPlan(theirs.coupleId, theirs.userId, { type: "dinner", title: "Theirs", ...EMPTY });

    const { idea, planned, done } = await listPlans(mine.coupleId);

    expect([...idea, ...planned, ...done]).toHaveLength(0);
  });
});

describe("getNextPlan", () => {
  beforeEach(resetDb);

  it("picks the soonest planned date at or after today, earliest time first", async () => {
    const { coupleId, userId } = await couple();
    await createPlan(coupleId, userId, { type: "dinner", title: "Past", onDate: "2026-09-01", atTime: "" });
    await createPlan(coupleId, userId, { type: "dinner", title: "Evening", onDate: "2026-10-03", atTime: "19:30" });
    await createPlan(coupleId, userId, { type: "dinner", title: "Lunch", onDate: "2026-10-03", atTime: "12:00" });
    await createPlan(coupleId, userId, { type: "dinner", title: "Far", onDate: "2026-12-01", atTime: "" });

    expect((await getNextPlan(coupleId, "2026-10-01"))?.title).toBe("Lunch");
  });

  it("ignores ideas, done plans and dateless plans", async () => {
    const { coupleId, userId } = await couple();
    await createPlan(coupleId, userId, { type: "dinner", title: "Dateless", ...EMPTY });
    const idea = await createPlan(coupleId, userId, { type: "dinner", title: "Idea", onDate: "2026-10-03", atTime: "" });
    const done = await createPlan(coupleId, userId, { type: "dinner", title: "Done", onDate: "2026-10-04", atTime: "" });
    if (!idea.ok || !done.ok) throw new Error("setup failed");
    await setPlanStatus(coupleId, idea.plan.id, "idea");
    await setPlanStatus(coupleId, done.plan.id, "done");

    expect(await getNextPlan(coupleId, "2026-10-01")).toBeNull();
  });
});
