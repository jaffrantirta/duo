# Duo — Server-Side Data Caching Design

**Date:** 2026-09-17
**Status:** Approved
**Builds on:** Phase 1 (auth/pairing) and Phase 2 (plans) — no new screens, no schema change. This
changes how existing reads are served.

## Context

Navigating between Home and Plans felt slow. Two causes were already fixed: no route had a
`loading.tsx` (so nothing appeared at all while a page loaded), and the proxy refreshed the
session — a database round trip — on every single navigation. Both are shipped.

What's left: every navigation to a protected route still re-runs full database queries for couple
info and plan data, even when nothing has changed since the last time the same couple asked. This
spec adds a server-side cache for those reads, invalidated exactly when a write changes them.

## Goals

- Repeat navigation to Home or Plans is served from a shared server-side cache instead of hitting
  Postgres, until something real changes.
- The cache is correct for **both** partners: no per-browser staleness, no client storage. A
  cache is invalidated once, centrally, and every subsequent reader — either partner, any device —
  gets the fresh result.
- A user's own action never shows them stale data. Creating a plan and landing back on `/plans`
  must show that plan, immediately, every time.

## Non-goals

- Caching the session/login check. It's security-sensitive (a cached "still signed in" answer
  that outlives a sign-out is a real bug class) and is not the slow part — the proxy's redundant
  copy of this check was already removed by throttling, not caching.
- Caching the single-plan lookup (`/plans/[id]`). Low traffic, and caching it would need its own
  per-plan invalidation for little payoff.
- Caching invite-related reads (`getActiveInvite`, `getInvitePreview`, `getInviteView`). These are
  only visited during the brief pre-pairing state, not the repeat-navigation pain point.
- Client-side caching (a library, localStorage, or cookies). Rejected earlier in this
  conversation: cookies can't hold a growing plans list, and any per-browser cache breaks the
  "both partners see the same list" guarantee this app exists to provide.
- Any new screen or schema change.

## Mechanism

Next.js 16's Data Cache, via `unstable_cache` for reads and `updateTag` for invalidation.
`updateTag` (not `revalidateTag`) is the deliberate choice: `revalidateTag`'s default profile is
stale-while-revalidate — the request right after a write can still see the *old* value while a
background refresh runs. `updateTag` is built for exactly this app's requirement ("read-your-own-
writes"): it can only be called from a Server Action, and it guarantees the next request blocks
for fresh data rather than serving anything stale.

Both `unstable_cache` and `updateTag` throw outside a real Next.js server request (confirmed
directly against the installed `next@16.3.5`: calling either from a bare Node process throws an
"Invariant" error). The existing Vitest suite calls the domain modules (`couples.ts`, `plans.ts`,
`invites.ts`) directly, outside that runtime. So caching and invalidation are added only as **new**
exports and **new** call sites — every existing export keeps its exact current signature and
behavior, untouched, so the whole existing test suite needs zero changes.

## Read side

**`src/lib/couples.ts`** — `getCoupleForUser(userId)` currently runs two queries inline: find the
user's couple id, then join for member details. Split into two new exports, and rebuild the
existing function from them (same signature, same behavior, existing tests pass unmodified):

- `findCoupleIdForUser(userId): Promise<string | null>` — the first query alone. Stays uncached;
  it's a single indexed lookup (`coupleMembers.userId` is unique) and already fast.
- `getCoupleById(coupleId): Promise<CoupleWithMembers | null>` — the join query alone, keyed by
  couple id rather than user id. This is also where a known parked bug gets fixed in passing: an
  empty result (reachable since a solo user's couple can now be deleted when they join a partner,
  per Phase 2) currently crashes on `rows[0]`; add the `rows.length === 0` guard here.
- `getCachedCoupleById(coupleId): Promise<CoupleWithMembers | null>` — `getCoupleById` wrapped in
  `unstable_cache`, tagged `couple-{coupleId}`.

Keying the cache by **couple id, not user id** is what makes the two-partner case correct: both
partners' reads land on the same cache entry, so one invalidation (below) is visible to both.

**`src/lib/session.ts`** — `requireCouple()` is the single choke point every protected page goes
through (Home, Plans, Plans/new, Plans/[id]). It already carries `import "server-only"`, so it's
guaranteed to only ever run inside a real request — safe to use `unstable_cache` here. It switches
from calling `getCoupleForUser` to `findCoupleIdForUser` + `getCachedCoupleById`. This is the one
change that gives every protected page the caching benefit, without each page needing to know
caching exists.

The root redirect (`src/app/page.tsx`) and onboarding's already-coupled check
(`src/app/onboarding/page.tsx`) keep calling the plain `getCoupleForUser` — low-traffic, one-time
checks, not worth the added surface.

**`src/lib/plans.ts`** — `listPlans` and `getNextPlan` are untouched. Two new exports wrap them
as-is:

- `getCachedPlans(coupleId)` — `listPlans` wrapped in `unstable_cache`, tagged `plans-{coupleId}`.
- `getCachedNextPlan(coupleId, today)` — `getNextPlan` wrapped in `unstable_cache`, tagged
  `plans-{coupleId}`. `today` is part of the cache key because it's listed explicitly in
  `unstable_cache`'s `keyParts` array (`["next-plan", coupleId, today]`) — the wrapped closure
  itself takes zero arguments, so there's nothing for `unstable_cache` to auto-capture there. A
  cached entry is only ever reused for the same calendar day — a midnight rollover naturally
  produces a fresh cache key rather than serving yesterday's answer.

`src/app/(app)/plans/page.tsx` and `src/app/(app)/home/page.tsx` call these cached versions
instead of the originals.

## Write side — invalidation

Both throwing-outside-Next-runtime constraints above mean invalidation cannot live inside the
domain modules either (Vitest calls `createPlan`, `updatePlan`, `acceptInvite`, etc. directly).
This matches the existing codebase already: `revalidatePath` calls live only in the Server Actions
layer today, never inside `plans.ts`. `updateTag` joins them there, at the same call sites:

- **`src/app/(app)/plans/actions.ts`** — the shared `refresh()` helper (currently called by all
  four plan mutation actions) takes a `coupleId` argument and adds
  `updateTag(\`plans-${coupleId}\`)` alongside its existing `revalidatePath` calls. All four call
  sites pass `couple.id`.
- **`src/app/invite/[token]/actions.ts`** — `acceptInviteAction`, on success, adds
  `updateTag(\`couple-${result.coupleId}\`)` before redirecting. This is the one place a second
  member joins an *already-cached* couple, and it's a different user's session than whoever
  cached it — this is the multi-partner correctness case the whole design exists to get right.

No change needed in `onboarding/actions.ts` (`createCoupleAction` creates a couple id that was
never cached, so the first read after redirect naturally populates the cache correctly) or in
`home/actions.ts` (`regenerateInviteAction` only touches the invites table, which isn't cached).

## What's explicitly not touched

Session/login checks, `getPlan`, invite-preview reads, `regenerateInviteAction` — see Non-goals.

- If a future feature ever writes to a couple's cached fields after pairing (for example, if
  `disabledPaths: ["/update-user"]` in `auth.ts` is ever relaxed, or a profile/settings screen is
  added that changes a member's name or image), that write must call
  `updateTag(\`couple-${coupleId}\`)` or the cached couple data goes stale for up to a year (no
  time-based revalidate window exists on that cache entry, by design — see Mechanism).

## Error handling

No new error paths. Cache misses transparently fall through to the same query that runs today; a
cache read failure is not a case `unstable_cache` exposes for the caller to handle differently.

## Testing

**No changes to the existing suite.** Every currently-tested export keeps its exact signature and
behavior; the new cached/invalidating code paths are new exports and new call sites the tests never
touch.

**New unit test:** `getCoupleById` (or `getCoupleForUser`, its composition) returns `null` rather
than throwing for a couple id with no rows — closes the parked bug, directly testable since it's
the uncached function.

**Existing Playwright e2e is the correctness regression test for this whole feature, but it
exercises the two invalidation tags unevenly.** The couple-invitation assertion (one partner sees
the other's name on `/home` immediately after they accept) is a genuine, isolated proof that
`updateTag(couple-{coupleId})` works: `acceptInviteAction` makes no `revalidatePath` call, so
nothing else could be making that read fresh. The plans assertions (create a plan, expect to see
it on `/plans` immediately; mark it done, expect it to move sections immediately; both partners
see the shared plan) prove the write-then-read flow works end to end, but `refresh()` in
`plans/actions.ts` also calls `revalidatePath("/plans")` and `revalidatePath("/home")` alongside
`updateTag(plans-{coupleId})` — and in Next 16, a `revalidatePath` call already fully expires the
same `unstable_cache` entries via an implicit path-based tag, with the same immediate-expiration
semantics as `updateTag`. So the plans assertions would pass identically even if
`updateTag(plans-{coupleId})` were deleted; they don't isolate it from that redundant mechanism.
The `plans-{coupleId}` tag is kept regardless — it's the correct long-term invalidation path for
any future reader of `getCachedPlans`/`getCachedNextPlan` that isn't also covered by those two
specific `revalidatePath` calls — but that's a design intent, not something the current suite
proves independently. It must still pass unmodified.

**Manual dev-server verification** (not a committed test — needs Next's real runtime and
observing whether a query actually ran, which Vitest can't do here): temporarily log inside the
uncached fetch functions, hit `/plans` twice and confirm the query fires once; mutate a plan via
its action and hit `/plans` a third time, confirm the change is visible immediately. Remove the
logging before committing. This follows the same pattern already used to verify the proxy's
session-refresh throttle.
