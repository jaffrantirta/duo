# Duo — Phase 2: Our Plans Design

**Date:** 2026-09-16
**Status:** Approved
**Builds on:** `docs/superpowers/specs/2026-09-13-duo-foundation-design.md` (Phase 1: auth, couple pairing, home)

## Product context

Phase 1 gave a couple a shared home screen with a day counter and nothing to do there.
Phase 2 adds the first real content: shared plans, and the app's first navigation.

A plan moves 💭 Idea → 📌 Planned → ❤️ Done. Ideas are cheap to jot down and most never get a
date; a plan becomes real when it gets one; marking it Done is a deliberate act, which Phase 4
(Memories) later turns into a memory.

## Goals

- Either partner can add a plan in a few taps, see both partners' plans in one list, and move a
  plan along its three statuses.
- The home screen shows the next upcoming plan, so it stops being a static day counter.
- Navigation exists, with room for Phases 3–5 to add tabs without rework.

## Non-goals (Phase 2)

- Realtime sync or notifications. A partner sees changes on their next page load.
- Budget, who-pays, place, notes, attachments, recurring plans, reminders.
- Comments or reactions on a plan.
- Any Phase 3–5 feature (swipe matching, memories, pet, streaks).

## Data model

One new table. All app tables follow Phase 1's conventions: `text` ids from
`crypto.randomUUID()`, `timestamptz` defaulting to `now()`.

**`plans`**
| column | type | notes |
|--------|------|-------|
| id | text PK | |
| couple_id | text FK → couples.id, ON DELETE CASCADE | every query filters on this |
| type | text NOT NULL | one of the 8 slugs below |
| title | text NOT NULL | 1–80 chars, trimmed |
| on_date | date NULL | `mode: "string"`, `YYYY-MM-DD` |
| at_time | time NULL | only meaningful when `on_date` is set |
| status | text NOT NULL DEFAULT 'idea' | `idea` \| `planned` \| `done` |
| created_by | text FK → user.id, ON DELETE CASCADE | who added it |
| created_at | timestamptz NOT NULL | |
| updated_at | timestamptz NOT NULL | `$onUpdate` |

Index: `plans_couple_id_idx` on `(couple_id)`.

`at_time` without `on_date` is rejected by validation, not by a database constraint — the form
cannot produce it, and a check constraint would be one more migration to maintain.

Postgres `time` reads back as `HH:MM:SS`. The domain module accepts `HH:MM` from forms and
trims the seconds off on the way out, so everything above the database sees `HH:MM`.

**Plan types** are a fixed TypeScript const, not a table:

| slug | emoji | label |
|------|-------|-------|
| dinner | 🍜 | Dinner |
| movie | 🎬 | Movie |
| trip | ✈️ | Trip |
| stay-home | 🏠 | Stay home |
| weekend | 🏖️ | Weekend |
| birthday | 🎂 | Birthday |
| anniversary | 💍 | Anniversary |
| surprise | ✨ | Surprise |

Stored as the slug. An unknown slug read back from the database renders with a neutral 📌 rather
than crashing, so a future type rename can't break existing rows.

## Domain module

`src/lib/plans.ts`, the only module that touches the `plans` table. Every function takes
`coupleId` from the caller, which always gets it from `requireCouple()` — never from client input.

```ts
export type PlanStatus = "idea" | "planned" | "done";
export type PlanType = "dinner" | "movie" | "trip" | "stay-home" | "weekend" | "birthday" | "anniversary" | "surprise";
export type Plan = typeof plans.$inferSelect;
export type PlanInput = { type: string; title: string; onDate: string; atTime: string };
export type PlanResult =
  | { ok: true; plan: Plan }
  | { ok: false; reason: "invalid_input"; fieldErrors: { type?: string; title?: string; onDate?: string; atTime?: string } }
  | { ok: false; reason: "not_found" };

createPlan(coupleId: string, userId: string, input: PlanInput): Promise<PlanResult>
updatePlan(coupleId: string, planId: string, input: PlanInput): Promise<PlanResult>
setPlanStatus(coupleId: string, planId: string, status: PlanStatus): Promise<PlanResult>
deletePlan(coupleId: string, planId: string): Promise<{ ok: boolean }>
getPlan(coupleId: string, planId: string): Promise<Plan | null>
listPlans(coupleId: string): Promise<{ idea: Plan[]; planned: Plan[]; done: Plan[] }>
getNextPlan(coupleId: string, today: string): Promise<Plan | null>
```

- Empty-string form values mean "not set": `onDate: ""` stores NULL.
- Every mutation scopes by `and(eq(plans.id, planId), eq(plans.coupleId, coupleId))`, so a plan id
  belonging to another couple returns `not_found` rather than acting on it.
- `updatePlan` never changes status — only `setPlanStatus` does. Adding a date to an idea leaves it
  an idea; the edit page shows the status buttons alongside the form, so promoting it is one tap.
- `listPlans` orders Ideas and Done by `created_at` descending, and Planned by `on_date` ascending
  with dateless plans last, then `created_at` descending.
- `getNextPlan` returns the soonest plan with `on_date >= today` and status `planned`, ordered by
  `on_date`, then `at_time` (nulls last), limit 1. `today` comes from the viewer's time zone.

## Validation

`src/lib/validation.ts` gains:

- `planTitleSchema` — trimmed, min 1 "Give it a name", max 80 "Keep it under 80 characters"
- `planTypeSchema` — `z.enum` over the 8 slugs, "Pick a type"
- `planDateSchema` — `z.iso.date()`, "Pick a valid date"
- `planTimeSchema` — `/^\d{2}:\d{2}$/`, "Pick a valid time"

Date and time are optional: an empty string passes and stores NULL. A time with no date fails with
"Pick a date for this time" on the `atTime` field. Unlike `together_since`, a plan's date may be in
the past or the future — you can log something you already did.

## Screens

### Navigation

A `(app)` route group layout wraps Home and Plans with a fixed bottom tab bar: Home (🏠) and Plans
(📅). The active tab is derived from the pathname in a client component. The layout adds bottom
padding so content clears the bar. Phase 1's `/home` moves under this layout; its own markup is
unchanged.

### `/plans`

Three sections in order — 📌 Planned, 💭 Ideas, ❤️ Done — each rendered only when it has rows.
A row shows the type emoji, the title, and the date ("Sat 3 Oct · 7:30 PM", or nothing when
dateless). The whole row links to `/plans/[id]`.

Empty state, when the couple has no plans at all: "Nothing planned yet 💭" with a line inviting
them to add the first one.

A floating "+ New plan" button links to `/plans/new`.

### `/plans/new`

A form: type (a grid of the 8 emoji buttons, one selected, a hidden input carries the slug), title,
optional date, optional time. Submitting creates the plan with status `idea` when it has no date,
`planned` when it has one, and redirects to `/plans`.

### `/plans/[id]`

The same form pre-filled, plus:
- status buttons: the two statuses the plan is not currently in, e.g. a planned plan offers
  "💭 Back to idea" and "❤️ Mark done"
- a delete button, which asks for confirmation in a native `confirm()` before submitting

A plan id that doesn't belong to the viewer's couple renders `notFound()`.

### Home

Under the hero, when `getNextPlan` returns a plan: a card showing the type emoji, title and
"Friday · 7:30 PM", linking to that plan. When there is none, no card — the hero stands alone as
it does today.

## Error handling

Server Actions validate with Zod and return typed field errors rendered inline, as onboarding does.
A missing or foreign plan id returns `not_found`, which the page turns into `notFound()` and the
actions turn into a redirect to `/plans`. Unexpected errors fall through to the existing
`app/error.tsx`.

## Testing

**Vitest (integration, against the test database):**
- `createPlan`: stores the fields; empty date and time store NULL; a title of only spaces is
  rejected; an unknown type is rejected; a time without a date is rejected; status is `planned`
  when a date is given and `idea` when it is not
- `updatePlan` / `setPlanStatus` / `deletePlan` / `getPlan`: succeed for the owning couple, and
  return `not_found` (or null, or no-op) for a plan id belonging to another couple
- `listPlans`: groups by status and applies the documented ordering, including dateless-last
- `getNextPlan`: ignores ideas and done plans, ignores past dates, ignores dateless plans, picks
  the soonest, and breaks ties by time

**Playwright (e2e),** extending the existing pairing spec's helpers: a paired user adds a plan with
a date, sees it on `/home` in the next-plan card, opens it, marks it done, and finds it under
❤️ Done with the home card gone.

## Out of scope, deliberately

No realtime, no notifications, no budget or who-pays, no place or notes field, no comments, no
recurrence, no reminders, no plan photos. Each of these was considered and cut; add one when its
absence actually hurts.
