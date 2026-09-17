# Duo Landing Page & Waitlist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A signed-out visitor to `/` sees a real landing page explaining Duo and can join a waitlist; a signed-in visitor is unaffected. `/sign-in` keeps working exactly as today, just unlinked from the public page.

**Architecture:** One new table (`waitlist`) and one domain module (`joinWaitlist`), following the exact conventions of `couples.ts`/`plans.ts`. `src/app/page.tsx`'s signed-out branch renders landing content instead of redirecting; its signed-in branch is untouched. A single `WaitlistForm` client component is rendered twice on the page (hero and footer).

**Tech Stack:** Next.js 16.3.5 · React 19 · Drizzle ORM 0.45.2 on Neon · Zod 4.6.4 · Tailwind v4 + shadcn (base-nova) · Vitest 5 · Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-09-17-duo-landing-waitlist-design.md`

## Global Constraints

- `waitlist.ts` follows the same convention as `couples.ts`/`plans.ts`/`invites.ts`: no `import "server-only"`, so it stays importable from Vitest directly. It uses no Next-runtime-only API (no `unstable_cache`, no `cookies()`), so this is a non-issue either way — just stay consistent with the existing modules.
- Email is normalized (trimmed, lowercased) inside the Zod schema, so both the stored value and the uniqueness check use the same form.
- A duplicate email returns `{ ok: true }`, identical to a first-time join. The caller must never be able to distinguish "just joined" from "already on the list."
- `waitlist` has no foreign key to any existing table, so it will **not** be cascade-truncated by the existing `RESET_SQL`. It must be added to that list explicitly, or waitlist rows accumulate across test runs.
- `WaitlistForm` is rendered twice on one page (hero + footer). Its input `id` must be unique per instance (`useId()`), not a fixed string — a duplicate DOM id breaks the `<label htmlFor>` association on the second instance.
- No `/sign-in` link or button anywhere on the landing page.
- No change to `src/proxy.ts`, `src/lib/auth.ts`, or `/sign-in` itself.
- Commit messages end with a blank line then:
  `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>`
  `Claude-Session: https://claude.ai/code/session_01KLxTYhoyjCkcsimyzjq1gQ`

## File Map

```
src/db/schema.ts                  + waitlist table
drizzle/0003_*.sql                generated migration
src/lib/validation.ts             + waitlistEmailSchema
src/lib/waitlist.ts               joinWaitlist domain module
tests/unit/waitlist.test.ts       domain tests
tests/helpers/reset-sql.ts        + waitlist to the TRUNCATE list
src/app/waitlist-actions.ts       joinWaitlistAction Server Action
src/components/waitlist-form.tsx  the email capture form (rendered twice)
src/components/feature-card.tsx   one feature row (emoji, title, description, status)
src/app/page.tsx                  landing content on the signed-out branch
tests/e2e/helpers.ts               shared magic-link sign-in helpers, extracted
tests/e2e/pairing.spec.ts         import the extracted helpers instead of local copies
tests/e2e/waitlist.spec.ts        new e2e spec
```

---

### Task 1: Waitlist table, validation, domain module

**Files:**
- Modify: `src/db/schema.ts`, `src/lib/validation.ts`, `tests/helpers/reset-sql.ts`
- Create: `src/lib/waitlist.ts`, `drizzle/0003_*.sql` (generated)
- Test: `tests/unit/waitlist.test.ts`

**Interfaces:**
- Consumes: `createdAt()` helper and `pgTable`/`text` imports already in `src/db/schema.ts`; `isUniqueViolation` from `@/db/errors`; `db` from `@/db`
- Produces:
  - `waitlist` table exported from `@/db/schema`
  - `waitlistEmailSchema` from `@/lib/validation` — `z.string().trim().toLowerCase().pipe(z.email("Enter a valid email"))`
  - `type JoinWaitlistResult = { ok: true } | { ok: false; error: string }` and `joinWaitlist(email: string): Promise<JoinWaitlistResult>` from `@/lib/waitlist`

- [ ] **Step 1: Write the failing tests** — `tests/unit/waitlist.test.ts`

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { joinWaitlist } from "@/lib/waitlist";
import { resetDb } from "../helpers/db";

describe("joinWaitlist", () => {
  beforeEach(resetDb);

  it("stores a trimmed, lowercased email", async () => {
    const result = await joinWaitlist("  Jaffran@Example.com  ");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(waitlist).where(eq(waitlist.email, "jaffran@example.com"));
    expect(rows).toHaveLength(1);
  });

  it("rejects an invalid email", async () => {
    const result = await joinWaitlist("not-an-email");
    expect(result).toEqual({ ok: false, error: "Enter a valid email" });
  });

  it("treats a duplicate as success without creating a second row", async () => {
    await joinWaitlist("sarah@example.com");

    const result = await joinWaitlist("Sarah@Example.com");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(waitlist).where(eq(waitlist.email, "sarah@example.com"));
    expect(rows).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run tests/unit/waitlist.test.ts`
Expected: FAIL, cannot resolve `@/lib/waitlist`.

- [ ] **Step 3: Add the table** — append to `src/db/schema.ts`, after the `plans` table

```ts
export const waitlist = pgTable("waitlist", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  email: text("email").notNull().unique(),
  createdAt: createdAt(),
});
```

- [ ] **Step 4: Add the validation schema** — append to `src/lib/validation.ts`

```ts
export const waitlistEmailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email("Enter a valid email"));
```

Verify `z.email(...)` is a valid top-level export in the installed zod (4.6.4) before using it — it is, confirmed directly: `z.email("message").safeParse(...)` behaves as expected, distinct from the `z.iso.date(...)` namespaced form used elsewhere in this file. If it's somehow unavailable, use `z.string().pipe(z.string().email("Enter a valid email"))` instead, keep the exact message text, and note the deviation.

- [ ] **Step 5: Add `waitlist` to the test-reset list** — in `tests/helpers/reset-sql.ts`, change

```ts
export const RESET_SQL =
  'TRUNCATE couple_invites, couple_members, couples, session, account, verification, "user" CASCADE';
```

to

```ts
export const RESET_SQL =
  'TRUNCATE couple_invites, couple_members, couples, session, account, verification, "user", waitlist CASCADE';
```

- [ ] **Step 6: Generate and apply the migration**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `drizzle/0003_*.sql` containing `CREATE TABLE "waitlist"` with a unique constraint on `email`. Migrations 0000–0002 untouched. Then `Migrations applied`.

- [ ] **Step 7: Implement** — `src/lib/waitlist.ts`

```ts
import { db } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { waitlist } from "@/db/schema";
import { waitlistEmailSchema } from "@/lib/validation";

export type JoinWaitlistResult = { ok: true } | { ok: false; error: string };

export async function joinWaitlist(email: string): Promise<JoinWaitlistResult> {
  const parsed = waitlistEmailSchema.safeParse(email);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Enter a valid email" };
  }

  try {
    await db.insert(waitlist).values({ email: parsed.data });
    return { ok: true };
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: true };
    throw err;
  }
}
```

- [ ] **Step 8: Run the tests to confirm they pass**

Run: `npx vitest run tests/unit/waitlist.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Full suite, typecheck, lint, build**

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass. Route table unchanged (this task adds no route).

- [ ] **Step 10: Commit**

```bash
git add src/db/schema.ts src/lib/validation.ts src/lib/waitlist.ts drizzle tests/helpers/reset-sql.ts tests/unit/waitlist.test.ts
git commit -m "feat: add waitlist table and join-waitlist domain logic"
```

---

### Task 2: Landing page

**Files:**
- Create: `src/app/waitlist-actions.ts`, `src/components/waitlist-form.tsx`, `src/components/feature-card.tsx`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: `joinWaitlist` from `@/lib/waitlist`; existing `getSession` from `@/lib/session`, `getCoupleForUser` from `@/lib/couples`; `Button`, `Input` from `@/components/ui/*`; `cn` from `@/lib/utils`
- Produces:
  - `type WaitlistFormState = { done?: boolean; error?: string }` and `joinWaitlistAction(prev, formData): Promise<WaitlistFormState>` from `@/app/waitlist-actions`
  - `<WaitlistForm />` from `@/components/waitlist-form`
  - `<FeatureCard emoji title description status="live" | "soon" />` from `@/components/feature-card`
  - `/` renders landing content for a signed-out visitor; a signed-in visitor still redirects to `/home` or `/onboarding` exactly as before

- [ ] **Step 1: Write the Server Action** — `src/app/waitlist-actions.ts`

```ts
"use server";

import { joinWaitlist } from "@/lib/waitlist";

export type WaitlistFormState = { done?: boolean; error?: string };

export async function joinWaitlistAction(
  _prev: WaitlistFormState,
  formData: FormData,
): Promise<WaitlistFormState> {
  const email = String(formData.get("email") ?? "");
  const result = await joinWaitlist(email);

  if (!result.ok) return { error: result.error };
  return { done: true };
}
```

- [ ] **Step 2: Write the form** — `src/components/waitlist-form.tsx`

```tsx
"use client";

import { useActionState, useId } from "react";
import { joinWaitlistAction, type WaitlistFormState } from "@/app/waitlist-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function WaitlistForm() {
  const id = useId();
  const [state, formAction, pending] = useActionState<WaitlistFormState, FormData>(joinWaitlistAction, {});

  if (state.done) {
    return (
      <p className="rounded-2xl bg-mint/60 px-4 py-3 text-center text-sm font-medium">
        You&apos;re on the list 💌 We&apos;ll let you know.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <div className="flex-1 space-y-1">
        <Label htmlFor={id} className="sr-only">
          Email
        </Label>
        <Input
          id={id}
          name="email"
          type="email"
          required
          placeholder="you@example.com"
          aria-invalid={Boolean(state.error)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.error && <p className="text-sm text-destructive">{state.error}</p>}
      </div>
      <Button type="submit" size="lg" className="h-12 shrink-0 rounded-2xl text-base" disabled={pending}>
        {pending ? "Joining…" : "Join the waitlist"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Write the feature card** — `src/components/feature-card.tsx`

```tsx
import { cn } from "@/lib/utils";

type Props = { emoji: string; title: string; description: string; status: "live" | "soon" };

export function FeatureCard({ emoji, title, description, status }: Props) {
  return (
    <div className="flex gap-4 rounded-3xl bg-card p-5">
      <span className="text-3xl" aria-hidden>
        {emoji}
      </span>
      <div className="flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-display text-lg font-bold">{title}</h3>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              status === "live" ? "bg-mint" : "bg-butter text-foreground/70",
            )}
          >
            {status === "live" ? "Live" : "Coming soon"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Rewrite the root page** — replace the full contents of `src/app/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { FeatureCard } from "@/components/feature-card";
import { WaitlistForm } from "@/components/waitlist-form";
import { getCoupleForUser } from "@/lib/couples";
import { getSession } from "@/lib/session";

const FEATURES: { emoji: string; title: string; description: string; status: "live" | "soon" }[] = [
  {
    emoji: "🗓️",
    title: "Our Plans",
    description: "Turn ideas into real plans together, from a dinner reservation to a weekend away.",
    status: "live",
  },
  {
    emoji: "💡",
    title: "Discover & Match",
    description: "You both swipe on date ideas. A mutual ❤️ is a match, and it goes straight into your plans.",
    status: "soon",
  },
  {
    emoji: "📸",
    title: "Memories",
    description: "Every plan you finish becomes a memory, building a timeline of your life together.",
    status: "soon",
  },
  {
    emoji: "🐻",
    title: "Shared pet & streaks",
    description: "A little pet you take care of together, growing with everything you do as a couple.",
    status: "soon",
  },
];

export default async function RootPage() {
  const session = await getSession();
  if (session) {
    const couple = await getCoupleForUser(session.user.id);
    redirect(couple ? "/home" : "/onboarding");
  }

  return (
    <div className="flex flex-1 flex-col gap-12 py-4">
      <header className="space-y-6">
        <p className="font-display text-7xl font-bold tracking-tight">duo</p>
        <p className="text-lg text-muted-foreground">A little world for the two of you.</p>
        <WaitlistForm />
      </header>

      <section className="space-y-4">
        <p className="text-center text-sm font-medium text-muted-foreground">
          Discover → Match → Plan → Do → Save Memory
        </p>
        <div className="space-y-3">
          {FEATURES.map((feature) => (
            <FeatureCard key={feature.title} {...feature} />
          ))}
        </div>
      </section>

      <footer className="space-y-4 text-center">
        <p className="font-display text-2xl font-bold">Want in?</p>
        <WaitlistForm />
      </footer>
    </div>
  );
}
```

- [ ] **Step 5: Verify against the dev server**

Start `next dev` in the background, capture the PID, poll `curl -s http://localhost:3000/api/auth/ok` until it answers.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
curl -s http://localhost:3000/ | grep -o "Our Plans"
curl -s http://localhost:3000/ | grep -o "Coming soon" | head -1
curl -s http://localhost:3000/ | grep -ic "sign in"
```

Expected: `200` (not the old `307`); "Our Plans" and "Coming soon" both present; the last command prints `0` (grep's count of "sign in" occurrences — it exits non-zero when the count is 0, which is expected and fine here, not a failure).

Then confirm the signed-in path is untouched: reuse the Task 7 (Phase 2) pattern — sign in via the magic-link API with a fresh `@duo.test` email, follow the link with a cookie jar — then:

```bash
curl -s -b jar -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/
```

Expected: `307` redirecting to `/onboarding` (a brand-new account has no couple yet).

Kill the dev server by PID afterward, delete `.e2e-mail/`. If port 3000 is busy, report it rather than killing unknown processes.

- [ ] **Step 6: Typecheck, lint, build**

```bash
npx tsc --noEmit && npm run lint && npm run build
```

Expected: all pass. Route table for `/` still shows `ƒ /` (unchanged path, new content).

- [ ] **Step 7: Commit**

```bash
git add src/app/waitlist-actions.ts src/components/waitlist-form.tsx src/components/feature-card.tsx src/app/page.tsx
git commit -m "feat: add landing page with waitlist signup"
```

---

### Task 3: End-to-end test

**Files:**
- Create: `tests/e2e/helpers.ts`, `tests/e2e/waitlist.spec.ts`
- Modify: `tests/e2e/pairing.spec.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–2
- Produces: `readMagicLink(email)`, `signInWithEmail(page, email)` from `tests/e2e/helpers.ts` — extracted so both spec files can use them without duplication

- [ ] **Step 1: Extract the shared helpers** — create `tests/e2e/helpers.ts` with exactly this content (it is `pairing.spec.ts`'s current top two functions, moved verbatim and exported)

```ts
import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

export async function readMagicLink(email: string): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        link = await readFile(`.e2e-mail/${email}.txt`, "utf8").then((s) => s.trim(), () => "");
        return link;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");
  return link;
}

export async function signInWithEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await readMagicLink(email));
}
```

- [ ] **Step 2: Update `pairing.spec.ts`** — remove its local `readMagicLink` and `signInWithEmail` function definitions (the two functions Step 1 just copied out), and add this import at the top of the file, alongside its existing imports:

```ts
import { readMagicLink, signInWithEmail } from "./helpers";
```

`readMagicLink` may end up unused directly in `pairing.spec.ts` if nothing there calls it outside `signInWithEmail` — if so, omit it from the import and keep only `signInWithEmail`. Nothing else in the file changes; every call site (`signInWithEmail(jaffran, jaffranEmail)`, etc.) stays exactly as it is.

- [ ] **Step 3: Confirm the existing suite still passes with the extraction**

Make sure no other dev server is running and port 3100 is free.

Run: `npm run test:e2e`
Expected: 1 passed (the existing pairing test, now using the extracted helpers, unchanged behavior).

- [ ] **Step 4: Write the new spec** — `tests/e2e/waitlist.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { signInWithEmail } from "./helpers";

test("landing page explains the features and captures a waitlist email, with no sign-in link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("A little world for the two of you.")).toBeVisible();
  await expect(page.getByText("Our Plans")).toBeVisible();
  await expect(page.getByText("Coming soon").first()).toBeVisible();

  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);

  const email = `waitlist-${Date.now()}@duo.test`;
  await page.getByLabel("Email").first().fill(email);
  await page.getByRole("button", { name: "Join the waitlist" }).first().click();

  await expect(page.getByText("You're on the list")).toBeVisible();
});

test("a signed-in visit to / redirects away from the landing page", async ({ page }) => {
  const email = `landing-redirect-${Date.now()}@duo.test`;

  await page.goto("/sign-in");
  await signInWithEmail(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
});
```

- [ ] **Step 5: Run everything**

Make sure no other dev server is running and ports 3000/3100 are free.

```bash
npm test && npx tsc --noEmit && npm run lint && npm run build && npm run test:e2e
```

Expected: unit suite passes, build is clean, and both e2e spec files pass (`pairing.spec.ts` unchanged behavior via the extracted helpers; `waitlist.spec.ts`'s two new tests). Afterwards delete `.e2e-mail/` and `test-results/`, and confirm `git status --short` is clean.

- [ ] **Step 6: Commit**

```bash
git add tests/e2e/helpers.ts tests/e2e/pairing.spec.ts tests/e2e/waitlist.spec.ts
git commit -m "test: extract e2e sign-in helper and add landing page spec"
```
