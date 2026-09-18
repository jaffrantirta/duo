# Duo — Discover & Match Design

**Date:** 2026-09-18
**Status:** Approved
**Builds on:** Phase 1 (auth/pairing) and Phase 2 (plans). Adds two new tables and one new
protected route; no changes to existing tables or screens beyond the bottom nav and the landing
page's feature-card status.

## Context

Duo's roadmap (shown on the public landing page) lists Discover & Match as the next feature after
Our Plans. Today, adding a plan requires a partner to already know what they want to do. Discover
& Match gives couples a low-effort way to surface ideas: a shared deck of date-idea cards that
each partner swipes on independently, with a match — both partners saying yes to the same card —
turning straight into a plan.

## Goals

- Each signed-in partner sees a deck of date-idea cards (a shared curated set, plus any custom
  cards their own couple has added) and taps ❤️ Yes or ✖️ No on one card at a time.
- A card is decided once per person, forever — no re-swiping, no undo.
- When both partners of a couple have said yes to the same card, it becomes a Plan (status
  `idea`) automatically, using the existing Plans feature — no new "match" data survives outside
  that.
- A partner can add their own custom idea to their couple's deck; doing so counts as their own
  yes vote on it.
- Works correctly for solo (unpaired) couples: swiping is still possible, matching just can't
  happen until a second member joins.

## Non-goals

- Drag/swipe gestures. Tap buttons only — no new animation or gesture dependency.
- Notifications (push or email) when a match happens or when a partner adds a card. Purely
  passive: the other partner discovers it next time they open Discover or Plans.
- Undo, re-swiping, or a "cards you passed on" review list.
- Caching the deck read. Unlike Home/Plans, this is a write-heavy, per-user, one-shot-consumption
  path — there's no repeat-read-of-the-same-answer pattern to cache, and every swipe would need
  to invalidate it anyway.
- An admin UI for managing the curated card catalog. New curated cards ship as a code change
  (a migration), same as the initial set.
- Editing or deleting a custom card after it's added.

## Data model

Two new tables, following existing conventions (`text` id from `crypto.randomUUID()`,
`timestamptz` default `now()`, plain `text` category column validated at the Zod layer only —
same as `plans.type`, no FK):

```ts
export const discoverCards = pgTable(
  "discover_cards",
  {
    id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
    // null = curated card, visible to every couple. Set = a custom card, visible only to that couple.
    coupleId: text("couple_id").references(() => couples.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    createdBy: text("created_by").references(() => user.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [index("discover_cards_couple_id_idx").on(t.coupleId)],
);

export const discoverSwipes = pgTable(
  "discover_swipes",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => discoverCards.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    decision: boolean("decision").notNull(),
    swipedAt: timestamp("swiped_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.cardId, t.userId] }), index("discover_swipes_user_id_idx").on(t.userId)],
);
```

The `(cardId, userId)` primary key is what makes a swipe one-shot: a second insert for the same
pair is a unique-violation, handled the same way `waitlist.ts` and `invites.ts` already treat
duplicates — as a harmless no-op, not an error.

### Seed data (curated deck)

Twenty curated cards (`coupleId = null`), shipped as a hand-authored migration
(`npx drizzle-kit generate --custom`) with **fixed ids** and `ON CONFLICT (id) DO NOTHING`, so it
applies safely and idempotently on every deploy through the existing `db:migrate` build step — no
manual seeding step, consistent with how every other schema change reaches production:

```sql
INSERT INTO discover_cards (id, couple_id, type, title, description, created_by, created_at) VALUES
  ('seed-01', NULL, 'dinner', 'Try a new restaurant', 'Pick a place neither of you has been to and split three dishes.', NULL, now()),
  ('seed-02', NULL, 'dinner', 'Cook a recipe you''ve never made', 'Choose something a little ambitious and cook it together.', NULL, now()),
  ('seed-03', NULL, 'dinner', 'Picnic, anywhere', 'A park bench counts as a picnic spot.', NULL, now()),
  ('seed-04', NULL, 'movie', 'Rewatch your first movie together', 'The one you saw on an early date — see how it holds up.', NULL, now()),
  ('seed-05', NULL, 'movie', 'Movie marathon, no phones', 'Pick a trilogy or a director and watch back to back.', NULL, now()),
  ('seed-06', NULL, 'movie', 'See something in a language neither of you speaks', 'Subtitles on, guess the ending before it happens.', NULL, now()),
  ('seed-07', NULL, 'trip', 'Day trip somewhere you''ve never been', 'Anywhere within two hours counts.', NULL, now()),
  ('seed-08', NULL, 'trip', 'Camp out for a night', 'Backyard counts if the weather doesn''t cooperate.', NULL, now()),
  ('seed-09', NULL, 'trip', 'Road trip with no destination', 'Pick a direction and turn off when something looks interesting.', NULL, now()),
  ('seed-10', NULL, 'trip', 'Visit a museum or gallery you keep meaning to go to', 'The one that''s been on the list for a year.', NULL, now()),
  ('seed-11', NULL, 'stay-home', 'Board game night', 'Loser does dishes for a week.', NULL, now()),
  ('seed-12', NULL, 'stay-home', 'Build a blanket fort', 'Watch something inside it. No adult reason needed.', NULL, now()),
  ('seed-13', NULL, 'stay-home', 'Cook breakfast for dinner', 'Pancakes at 7pm, no judgment.', NULL, now()),
  ('seed-14', NULL, 'weekend', 'Explore a neighborhood you''ve never walked', 'Pick a random spot on the map and wander it for an afternoon.', NULL, now()),
  ('seed-15', NULL, 'weekend', 'Farmers market morning', 'Buy only things you''ve never cooked with.', NULL, now()),
  ('seed-16', NULL, 'weekend', 'Spa day at home', 'Face masks, playlist, phones in another room.', NULL, now()),
  ('seed-17', NULL, 'birthday', 'Plan a surprise for their next birthday', 'Start early — the good surprises take lead time.', NULL, now()),
  ('seed-18', NULL, 'anniversary', 'Recreate your first date', 'Same place if it still exists, same order if you remember it.', NULL, now()),
  ('seed-19', NULL, 'surprise', 'Leave a note somewhere they''ll find it', 'No occasion required.', NULL, now()),
  ('seed-20', NULL, 'surprise', 'Plan a surprise ''no plans'' day', 'Clear the calendar and don''t say why.', NULL, now())
ON CONFLICT (id) DO NOTHING;
```

## Domain module

`src/lib/discover.ts`, the only module that touches `discover_cards` and `discover_swipes`:

```ts
export type DiscoverCard = { id: string; type: string; title: string; description: string };

export type AddCardInput = { type: string; title: string; description: string };
export type AddCardFieldErrors = { type?: string; title?: string; description?: string };
export type AddCardResult = { ok: true; card: DiscoverCard } | { ok: false; fieldErrors: AddCardFieldErrors };

export type SwipeResult = { ok: true; match: boolean; plan?: Plan } | { ok: false; reason: "not_found" };

export async function getNextCard(coupleId: string, userId: string): Promise<DiscoverCard | null>;
export async function addCard(coupleId: string, userId: string, input: AddCardInput): Promise<AddCardResult>;
export async function swipeCard(
  coupleId: string,
  userId: string,
  partnerId: string | null,
  cardId: string,
  decision: boolean,
): Promise<SwipeResult>;
```

- `getNextCard` — the oldest card (global or this couple's own) that `userId` has no swipe row
  for yet, ordered by `createdAt asc`. `null` means the deck is empty for this person right now.
- `addCard` — validates with a new Zod schema in `validation.ts`:
  `export const discoverCardDescriptionSchema = z.string().trim().min(1, "Say a bit more").max(200, "Keep it under 200 characters");`
  Reuses the existing `planTypeSchema` and `planTitleSchema` for type and title — same 80-char cap
  and same category enum as plans, no new taxonomy. On success, inserts the card
  (`coupleId`, `createdBy: userId`) and an auto-yes swipe row for `userId` in one transaction.
- `swipeCard` — inserts the swipe row; a unique-violation (already swiped this card) is treated
  as success with `match: false`, the same idempotent-duplicate pattern used elsewhere in this
  codebase. On a fresh `decision: true` insert, checks whether `partnerId` (`null` for an
  unpaired/solo couple) already has a `decision: true` row for the same card; if so, inserts a
  Plan (`type`/`title` copied from the card, `status: "idea"`, `onDate`/`atTime` null,
  `createdBy: userId`) in the same transaction and returns `{ ok: true, match: true, plan }`.
  `partnerId` is resolved by the caller from `requireCouple()`'s existing `couple.members` list
  (the member whose `id` isn't the current user's) — no new query needed.

## Routing & screens

**`src/app/(app)/discover/page.tsx`** (new, protected via `requireCouple()` like Home/Plans):
reads `searchParams: Promise<{ matched?: string }>`. Calls `getNextCard(couple.id, user.id)`.

- If `matched=1` is present, shows a one-time banner: "It's a match! 🎉 Added to your plans."
- If a card exists: renders it (emoji from `planEmoji(card.type)`, title, description) with two
  button-forms — `<form action={swipeCardAction.bind(null, card.id, true)}>` and `...bind(null,
  card.id, false)` — mirroring the existing bound-action pattern used by
  `plan-actions.tsx`/`setPlanStatusAction`.
- If no card: empty state — "You're all caught up" — with a link to `/discover/new`.
- A link to `/discover/new` ("+ Add your own idea") is also always visible, same placement as
  Plans' "+ New" header button.

**`src/app/(app)/discover/actions.ts`** (new):

```ts
export async function swipeCardAction(cardId: string, decision: boolean): Promise<void> {
  const { user, couple } = await requireCouple();
  const partnerId = couple.members.find((m) => m.id !== user.id)?.id ?? null;
  const result = await swipeCard(couple.id, user.id, partnerId, cardId, decision);
  if (result.ok && result.match) {
    revalidatePath("/plans");
    revalidatePath("/home");
    updateTag(`plans-${couple.id}`);
    redirect("/discover?matched=1");
  }
  redirect("/discover");
}

export type AddCardFormState = { fieldErrors?: AddCardFieldErrors; values?: { type: string; title: string; description: string } };

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
```

A match reuses exactly the invalidation the Plans feature already relies on
(`plans-{coupleId}` tag + the two `revalidatePath` calls), so a matched card shows up on `/plans`
and `/home` immediately for the partner who completed the match — same guarantee the caching spec
already established for creating a plan directly.

**`src/app/(app)/discover/new/page.tsx`** (new) + **`src/components/discover-card-form.tsx`**
(new, client component): structurally mirrors `plans/new/page.tsx` and `plan-form.tsx` — a type
picker grid (reusing `PLAN_TYPES`), a title input, and a new description `<textarea>`, submitting
via `useActionState` to `addCardAction`.

## Nav & landing page

- `src/components/bottom-nav.tsx`: add a third tab after Plans —
  `{ href: "/discover", label: "Discover", icon: Compass }` (from `lucide-react`, already a
  dependency) — so nav order matches the roadmap order: Home, Plans, Discover.
- `src/app/page.tsx`'s `FEATURES` array: flip Discover & Match's status from `"Coming soon"` to
  `"Live"`.

## Error handling

- `addCard` follows the exact `PlanFieldErrors`-style pattern: Zod validation, inline field
  errors, values preserved on error — same as `plan-form.tsx`.
- `swipeCard`'s only failure mode is `not_found` (a stale/foreign card id — e.g., a global card
  removed between page load and submit, which never happens today since nothing deletes curated
  cards, but the type models it honestly). The action redirects to `/discover` either way; there's
  no field to show an inline error against.
- A double-submit of the same swipe (e.g. a slow network causing a resubmit) is idempotent by the
  unique constraint, never a duplicate Plan.

## Testing

**Vitest (integration, against the test database):** `getNextCard` — returns a couple's own
custom cards and global cards, never another couple's custom cards, and never a card the user
already swiped; returns `null` when the deck is exhausted. `addCard` — creates the card and an
auto-yes swipe in one call; rejects invalid input with field errors. `swipeCard` — a lone "yes"
records the swipe and returns `match: false`; a second partner's "yes" on the same card returns
`match: true` and creates a Plan with the card's type/title and status `idea`; a "no" never
matches; re-swiping the same card by the same user is idempotent (`match: false`, no duplicate
Plan); a solo couple (`partnerId: null`) can swipe without crashing and never matches.

**Playwright (e2e), new file** (`tests/e2e/discover.spec.ts`): both partners sign in; one swipes a
card yes, confirms it doesn't yet appear on `/plans`; the other partner swipes the same card yes
and is redirected to `/discover?matched=1` showing the match banner; both partners then see the
new Idea on `/plans`. Separately: adding a custom card via `/discover/new` makes it appear in the
*other* partner's deck (not the creator's, since the creator implicitly already said yes).
