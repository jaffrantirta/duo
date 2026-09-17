# Duo Data Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Repeat navigation to Home or Plans is served from a server-side cache instead of hitting Postgres, correctly invalidated the instant a write changes it, for both partners.

**Architecture:** Two new cached read functions per domain (`couples.ts`, `plans.ts`), wired only into the one shared choke point every protected page already goes through (`requireCouple()`) plus the two page files that read plans directly. Every existing exported function keeps its exact current signature and behavior — caching and invalidation are additions, never edits to tested logic. Invalidation uses `updateTag`, called only from the Server Actions that already exist, alongside their current `revalidatePath` calls.

**Tech Stack:** Next.js 16.3.5 (`unstable_cache`, `updateTag` from `next/cache`) · Drizzle ORM 0.45.2 on Neon · Vitest 5

**Spec:** `docs/superpowers/specs/2026-09-17-duo-data-caching-design.md`

## Global Constraints

- Every existing exported function in `couples.ts`, `plans.ts`, and every existing Vitest test must keep passing completely unmodified. Caching lives only in new exports; invalidation lives only in Server Actions.
- Cache keys: couple reads are tagged `couple-{coupleId}` (never keyed by userId — both partners must share one cache entry). Plan reads are tagged `plans-{coupleId}`.
- Invalidation uses `updateTag`, not `revalidateTag`. `revalidateTag`'s default profile is stale-while-revalidate and would let a user's own action still show them old data on the very next page load — confirmed directly against the installed `next@16.3.5` by reading its docs, not assumed.
- Both `unstable_cache` and `updateTag` throw when called outside a real Next.js server request (confirmed directly: a bare Node call throws an "Invariant" error). Never call either from a function Vitest calls directly.
- `getCoupleById` returns `null` for a couple id with no rows instead of crashing on `rows[0]` (closes a parked bug from Phase 2's final review — reachable since a solo user's couple can be deleted when they join a partner).
- No `next.config.ts` changes, no new dependencies. `unstable_cache`/`updateTag` work today without enabling Next's experimental Cache Components mode.

## File Map

```
src/lib/couples.ts                 + findCoupleIdForUser, getCoupleById, getCachedCoupleById
src/lib/session.ts                 requireCouple() uses the cached path
src/lib/plans.ts                   + getCachedPlans, getCachedNextPlan
src/app/(app)/plans/page.tsx       calls getCachedPlans
src/app/(app)/home/page.tsx        calls getCachedNextPlan
src/app/(app)/plans/actions.ts     refresh(coupleId) + updateTag, 4 call sites updated
src/app/invite/[token]/actions.ts  acceptInviteAction + updateTag
tests/unit/couples.test.ts         + getCoupleById empty-guard test
```

---

### Task 1: Cache couple reads, keyed by couple id

**Files:**
- Modify: `src/lib/couples.ts`, `src/lib/session.ts`
- Test: `tests/unit/couples.test.ts`

**Interfaces:**
- Consumes: existing `db`, `coupleMembers`, `couples`, `user` from `@/db/schema`; `createInvite` from `@/lib/invites`
- Produces:
  - `findCoupleIdForUser(userId: string): Promise<string | null>` from `@/lib/couples`
  - `getCoupleById(coupleId: string): Promise<CoupleWithMembers | null>` from `@/lib/couples`
  - `getCachedCoupleById(coupleId: string): Promise<CoupleWithMembers | null>` from `@/lib/couples`
  - `getCoupleForUser(userId: string): Promise<CoupleWithMembers | null>` — same signature and behavior as today, now composed from the two functions above
  - `requireCouple()` in `@/lib/session` — same signature and behavior, now backed by the cached path

- [ ] **Step 1: Write the failing test** — append to `tests/unit/couples.test.ts`, adding `getCoupleById` to the existing `@/lib/couples` import on line 5

```ts
describe("getCoupleById", () => {
  beforeEach(resetDb);

  it("returns null for a couple id that doesn't exist", async () => {
    expect(await getCoupleById("not-a-real-id")).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/couples.test.ts`
Expected: FAIL, `getCoupleById` is not exported from `@/lib/couples`.

- [ ] **Step 3: Rewrite `src/lib/couples.ts`** — full file, replacing the existing content

```ts
import { asc, eq } from "drizzle-orm";
import { unstable_cache } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { coupleMembers, couples, user } from "@/db/schema";
import { todayInTimeZone } from "@/lib/dates";
import { createInvite } from "@/lib/invites";
import { nameSchema, togetherSinceSchema } from "@/lib/validation";

export type CreateCoupleInput = { name: string; togetherSince: string };

export type CreateCoupleResult =
  | { ok: true; coupleId: string }
  | { ok: false; reason: "invalid_input"; fieldErrors: { name?: string; togetherSince?: string } }
  | { ok: false; reason: "already_in_couple" };

export type CoupleMember = { id: string; name: string; image: string | null };

export type CoupleWithMembers = { id: string; togetherSince: string; members: CoupleMember[] };

const createCoupleSchema = z.object({ name: nameSchema, togetherSince: togetherSinceSchema });

export async function createCouple(
  userId: string,
  input: CreateCoupleInput,
  timeZone: string,
): Promise<CreateCoupleResult> {
  const parsed = createCoupleSchema.safeParse(input);
  if (!parsed.success) {
    const errors = z.flattenError(parsed.error).fieldErrors;
    return {
      ok: false,
      reason: "invalid_input",
      fieldErrors: { name: errors.name?.[0], togetherSince: errors.togetherSince?.[0] },
    };
  }

  const { name, togetherSince } = parsed.data;
  if (togetherSince > todayInTimeZone(timeZone)) {
    return { ok: false, reason: "invalid_input", fieldErrors: { togetherSince: "That date is in the future" } };
  }

  try {
    const coupleId = await db.transaction(async (tx) => {
      await tx.update(user).set({ name }).where(eq(user.id, userId));
      const [couple] = await tx.insert(couples).values({ togetherSince }).returning({ id: couples.id });
      await tx.insert(coupleMembers).values({ coupleId: couple.id, userId });
      await createInvite(tx, { coupleId: couple.id, createdBy: userId });
      return couple.id;
    });
    return { ok: true, coupleId };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "already_in_couple" };
    throw err;
  }
}

// Uncached: a single indexed lookup, already fast, and it's the function that decides
// whether the (cached) join query below even needs to run.
export async function findCoupleIdForUser(userId: string): Promise<string | null> {
  const [membership] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return membership?.coupleId ?? null;
}

// Uncached, keyed by coupleId (not userId) so both partners share one cache entry above.
export async function getCoupleById(coupleId: string): Promise<CoupleWithMembers | null> {
  const rows = await db
    .select({
      coupleId: couples.id,
      togetherSince: couples.togetherSince,
      memberId: user.id,
      memberName: user.name,
      memberImage: user.image,
    })
    .from(couples)
    .innerJoin(coupleMembers, eq(coupleMembers.coupleId, couples.id))
    .innerJoin(user, eq(user.id, coupleMembers.userId))
    .where(eq(couples.id, coupleId))
    .orderBy(asc(coupleMembers.joinedAt));

  if (rows.length === 0) return null;

  return {
    id: rows[0].coupleId,
    togetherSince: rows[0].togetherSince,
    members: rows.map((row) => ({ id: row.memberId, name: row.memberName, image: row.memberImage })),
  };
}

export async function getCoupleForUser(userId: string): Promise<CoupleWithMembers | null> {
  const coupleId = await findCoupleIdForUser(userId);
  if (!coupleId) return null;
  return getCoupleById(coupleId);
}

// unstable_cache throws outside a real Next.js request, so this must never be called
// from a Vitest test — only from src/lib/session.ts, which is already server-only.
export function getCachedCoupleById(coupleId: string): Promise<CoupleWithMembers | null> {
  return unstable_cache(() => getCoupleById(coupleId), ["couple-by-id", coupleId], {
    tags: [`couple-${coupleId}`],
  })();
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/couples.test.ts`
Expected: PASS, including the existing tests unmodified.

- [ ] **Step 5: Wire `requireCouple()` to the cached path** — in `src/lib/session.ts`, replace this exact import line:

```ts
import { getCoupleForUser, type CoupleWithMembers } from "@/lib/couples";
```

with:

```ts
import { findCoupleIdForUser, getCachedCoupleById, type CoupleWithMembers } from "@/lib/couples";
```

Then replace the body of `requireCouple` (everything else in the file — `getSession`, `requireUser` — stays untouched):

```ts
export async function requireCouple(): Promise<{ user: SessionUser; couple: CoupleWithMembers }> {
  const user = await requireUser();
  const coupleId = await findCoupleIdForUser(user.id);
  if (!coupleId) redirect("/onboarding");
  const couple = await getCachedCoupleById(coupleId);
  // A couple id with no rows here means it was deleted between the two lookups above — the
  // same narrow race the empty-rows guard above exists for. Treat it the same way.
  if (!couple) redirect("/onboarding");
  return { user, couple };
}
```

- [ ] **Step 6: Full suite, typecheck, lint, build**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass, route table unchanged.

- [ ] **Step 7: Commit**

```bash
git add src/lib/couples.ts src/lib/session.ts tests/unit/couples.test.ts
git commit -m "feat: cache couple reads by couple id"
```

---

### Task 2: Cache plan reads and wire up all invalidation

**Files:**
- Modify: `src/lib/plans.ts`, `src/app/(app)/plans/page.tsx`, `src/app/(app)/home/page.tsx`, `src/app/(app)/plans/actions.ts`, `src/app/invite/[token]/actions.ts`

**Interfaces:**
- Consumes: existing `listPlans`, `getNextPlan`, `type Plan` from `@/lib/plans`; `getCachedCoupleById`'s tag scheme from Task 1 (for reference — this task adds the matching `plans-{coupleId}` tag independently)
- Produces:
  - `getCachedPlans(coupleId: string): Promise<{ idea: Plan[]; planned: Plan[]; done: Plan[] }>` from `@/lib/plans`
  - `getCachedNextPlan(coupleId: string, today: string): Promise<Plan | null>` from `@/lib/plans`
  - `refresh(coupleId: string): void` in `plans/actions.ts` (was `refresh(): void`) — internal, not exported, but its new signature is what the four action functions call

- [ ] **Step 1: Add the cached wrappers to `src/lib/plans.ts`** — add `unstable_cache` to the top import line

```ts
import { unstable_cache } from "next/cache";
```

— and append at the end of the file, after `getNextPlan`

```ts
// unstable_cache throws outside a real Next.js request — only call these from page.tsx
// files, never from a function Vitest calls directly.
export function getCachedPlans(coupleId: string): Promise<{ idea: Plan[]; planned: Plan[]; done: Plan[] }> {
  return unstable_cache(() => listPlans(coupleId), ["plans-grouped", coupleId], {
    tags: [`plans-${coupleId}`],
  })();
}

export function getCachedNextPlan(coupleId: string, today: string): Promise<Plan | null> {
  return unstable_cache(() => getNextPlan(coupleId, today), ["next-plan", coupleId, today], {
    tags: [`plans-${coupleId}`],
  })();
}
```

- [ ] **Step 2: Switch the two pages to the cached reads**

In `src/app/(app)/plans/page.tsx`, change the import `listPlans` → `getCachedPlans` and the call `await listPlans(couple.id)` → `await getCachedPlans(couple.id)`. Nothing else in that file changes.

In `src/app/(app)/home/page.tsx`, change the import `getNextPlan` → `getCachedNextPlan` and the call `await getNextPlan(couple.id, todayInTimeZone(timeZone))` → `await getCachedNextPlan(couple.id, todayInTimeZone(timeZone))`. Nothing else in that file changes.

- [ ] **Step 3: Invalidate on every plan mutation** — in `src/app/(app)/plans/actions.ts`, change the top import and the `refresh` helper

```ts
import { revalidatePath, updateTag } from "next/cache";
```

```ts
function refresh(coupleId: string) {
  revalidatePath("/plans");
  revalidatePath("/home");
  updateTag(`plans-${coupleId}`);
}
```

Update all four call sites — `createPlanAction`, `updatePlanAction`, `setPlanStatusAction`, `deletePlanAction` — from `refresh();` to `refresh(couple.id);`. Each already has `couple` in scope from its own `requireCouple()` call.

- [ ] **Step 4: Invalidate when a member joins** — in `src/app/invite/[token]/actions.ts`, add the import and the call

```ts
import { updateTag } from "next/cache";
```

Replace

```ts
  if (result.ok) redirect("/home");
```

with

```ts
  if (result.ok) {
    updateTag(`couple-${result.coupleId}`);
    redirect("/home");
  }
```

- [ ] **Step 5: Full suite, typecheck, lint, build**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass, route table unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/lib/plans.ts "src/app/(app)/plans/page.tsx" "src/app/(app)/home/page.tsx" "src/app/(app)/plans/actions.ts" "src/app/invite/[token]/actions.ts"
git commit -m "feat: cache plan reads and invalidate on every write"
```

---

### Task 3: Verify caching and invalidation end to end

**Files:** none committed from this task except the final e2e run's cleanup (`.e2e-mail/`, `test-results/` are git-ignored)

**Interfaces:**
- Consumes: everything from Tasks 1–2
- Produces: no new code — a manual verification record in the report, plus a passing full regression run

- [ ] **Step 1: Confirm the cache actually skips the database on a repeat read**

Temporarily add a `console.log("DB HIT", coupleId)` as the first line of `getCoupleById` in `src/lib/couples.ts` and `fetchPlansForCouple`-equivalent — i.e. the first line of `listPlans` and `getNextPlan` in `src/lib/plans.ts` (three temporary log lines total). Do not commit these.

Start `next dev` in the background, capture its PID, poll `curl -s http://localhost:3000/api/auth/ok` until it answers. Using the Task 7 (Phase 2) pattern — sign in via the magic-link API with a unique `@duo.test` email, follow the link with a cookie jar, and use a `tsx` scratch script (in the scratchpad directory, not the repo) with `createCouple` to give the account a couple.

```bash
curl -s -b jar http://localhost:3000/home > /dev/null
curl -s -b jar http://localhost:3000/plans > /dev/null
curl -s -b jar http://localhost:3000/home > /dev/null
curl -s -b jar http://localhost:3000/plans > /dev/null
```

Expected in the dev server's log output: `DB HIT` for the couple appears once (the first `/home`), `DB HIT` for plans appears once (the first `/plans`) — the second `/home` and second `/plans` produce no new `DB HIT` lines.

- [ ] **Step 2: Confirm read-your-own-writes**

Using the same session, create a plan via a `tsx` scratch script calling `createPlan`, then `curl -s -b jar http://localhost:3000/plans` and grep the response for the plan's title. Expected: present immediately, on the very first request after creation — this is what `updateTag` guarantees, as opposed to `revalidateTag`'s stale-while-revalidate default.

- [ ] **Step 3: Confirm the multi-partner case**

Extend the scratch setup with a second signed-in session (pattern from the Phase 2 e2e test: two cookie jars, two `@duo.test` emails). Have the first user create the couple and note the invite token (`getActiveInvite`); have the second user accept it via a `tsx` script calling `acceptInvite`. Then, using the **first** user's cookie jar (which already has a cached couple entry from Step 1's `/home` request, showing only one member), request `/home` again and confirm the page now shows both members' names — proving `updateTag(`couple-${coupleId}`)` in `acceptInviteAction` correctly invalidated the first user's stale cache entry, not just the second user's fresh one.

- [ ] **Step 4: Clean up**

Remove the three temporary `console.log` lines from `src/lib/couples.ts` and `src/lib/plans.ts`. Kill the dev server by PID. Delete `.e2e-mail/`, `test-results/`, and any scratch scripts. Confirm `git status --short` shows no changes (Steps 1–3 touched no files that should remain modified).

- [ ] **Step 5: Full regression run, including e2e**

Make sure no other dev server is running and ports 3000/3100 are free.

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build && npm run test:e2e
```

Expected: unit suite passes unmodified, build is clean, and — this is the real correctness check for the whole feature — the existing Playwright pairing-and-plans spec still passes without any changes to the test itself. That spec already asserts a created plan appears immediately and a status change is reflected immediately; if `updateTag` invalidation were wrong anywhere, this is what would fail. Afterwards delete `.e2e-mail/` and `test-results/` again, and confirm `git status --short` is clean — there is nothing to commit from this task beyond what Tasks 1–2 already committed.
