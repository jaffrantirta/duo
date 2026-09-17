# Duo — Landing Page & Waitlist Design

**Date:** 2026-09-17
**Status:** Approved
**Builds on:** Phase 1 (auth/pairing) and Phase 2 (plans) — no changes to either. This changes
what `/` shows to a signed-out visitor and adds one new table.

## Context

Duo has had no public-facing page — `/` immediately redirected anyone without a session to
`/sign-in`, a bare login form with no explanation of what the app is. Before inviting more people
in, the app needs a real landing page that explains it, plus a way to capture interest from people
who aren't signed up yet. Sign-in itself stays exactly as it is; it just stops being the first
thing a stranger sees.

## Goals

- A signed-out visitor to `/` sees a real landing page: what Duo is, its features (built and
  planned), and a way to join a waitlist.
- A signed-in visitor to `/` is unaffected — still routed straight to `/home` or `/onboarding`.
- `/sign-in` keeps working exactly as today for anyone who has the link. It is simply not linked
  from the landing page.
- Joining the waitlist is a single email field; re-submitting an email already on the list
  succeeds the same way a first submission does.

## Non-goals

- Gating sign-up behind waitlist approval. Anyone who reaches `/sign-in` (by bookmark, by a link
  you send them, by guessing the URL) can still sign in and use the app, same as today.
- A waitlist confirmation email. The on-page "you're on the list" message is the only
  confirmation.
- An admin page to view waitlist signups. Query the database directly when needed.
- Any change to `/sign-in`, the proxy, or auth.

## Data model

One new table, following the existing conventions (`text` id from `crypto.randomUUID()`,
`timestamptz` default `now()`):

**`waitlist`**
| column | type | notes |
|--------|------|-------|
| id | text PK | |
| email | text NOT NULL UNIQUE | trimmed, lowercased before storage |
| created_at | timestamptz NOT NULL | |

No name, no source, no status column — nothing beyond what "who wants in, and when" needs.

## Domain module

`src/lib/waitlist.ts`, the only module that touches the `waitlist` table:

```ts
export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };
export async function joinWaitlist(email: string): Promise<JoinWaitlistResult>;
```

- Validates with a Zod schema in `src/lib/validation.ts`:
  `waitlistEmailSchema = z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"))`.
  Trimming and lowercasing happen inside the schema, so the stored value and the uniqueness check
  both use the normalized form.
- On insert, a unique-violation (checked via the existing `isUniqueViolation` helper) is treated
  as success, not an error — the caller can't tell "just joined" from "already on the list" apart,
  by design, and doesn't need to.
- No `coupleId`, no auth check — this is the one write path in the app available to a signed-out
  visitor.

## Routing change

`src/app/page.tsx` today:

```ts
export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const couple = await getCoupleForUser(session.user.id);
  redirect(couple ? "/home" : "/onboarding");
}
```

Changes to: if there's no session, render the landing page directly instead of redirecting. The
signed-in branch (redirect to `/home` or `/onboarding`) is unchanged.

No change to `src/proxy.ts`: its matcher already includes `/`, but `PROTECTED_PATHS` (`/home`,
`/onboarding`) does not, so the proxy already lets a signed-out request to `/` through — the
redirect signed-out visitors currently get comes from `page.tsx` itself, not the proxy.

## Screens

### `/` (signed out) — the landing page

Sections, top to bottom:

1. **Hero** — the "duo" wordmark, a tagline, and the waitlist email field as the primary call to
   action. No "Sign in" link or button anywhere on the page.
2. **The core loop** — one line naming Discover → Match → Plan → Do → Save Memory.
3. **Feature cards**, one per phase, in build order, each with an emoji, a name, one to two
   sentences, and a status:
   - 🗓️ Our Plans — **Live**
   - 💡 Discover & Match — **Coming soon**
   - 📸 Memories — **Coming soon**
   - 🐻 Shared pet & streaks — **Coming soon**
4. **Waitlist form again** at the bottom, same field, same action.

The waitlist form is one client component (`WaitlistForm`) rendered twice (hero + bottom), not two
separate implementations. Submitting swaps that instance to a thank-you state; the other instance
is unaffected until its own submission.

### `/sign-in`

Unchanged. Still reachable directly by anyone with the URL.

## Error handling

Server Action validates with Zod and returns a typed field error, rendered inline — same pattern
as every other form in the app (onboarding, plans). An invalid email shows "Enter a valid email"
under the field; nothing else can fail on this path (no auth, no couple scoping, and a duplicate
email is handled as success rather than an error).

## Testing

**Vitest (integration, against the test database):** `joinWaitlist` — stores a valid email;
trims and lowercases before storage and before the uniqueness check (`"  A@B.com "` and `"a@b.com"`
collide); rejects an invalid email with the exact message; a duplicate submission returns
`{ ok: true }` without creating a second row.

**Playwright (e2e), a new file** (`tests/e2e/waitlist.spec.ts`, not appended to the existing
pairing spec — unrelated subject matter, and that file was already flagged as due for a split):
a signed-out visit to `/` shows the landing page and its feature cards; submitting the waitlist
form shows the thank-you state; there is no sign-in link anywhere on the page (a negative
assertion — no element with the accessible name "Sign in" or similar); a signed-in visit to `/`
(reusing the existing magic-link sign-in helper pattern) still redirects to `/onboarding` or
`/home`, proving the routing change didn't touch the signed-in path.
