# Duo Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Two people can sign in (magic link or Google), pair through an invite link, and both see a shared home screen reading "{A} ❤️ {B} · together for N days", deployed on Vercel with Neon.

**Architecture:** A single Next.js 16 App Router app. Pages are React Server Components; all mutations are Server Actions that call small domain modules in `src/lib/` (`couples.ts`, `invites.ts`), which talk to Neon through Drizzle ORM's `neon-serverless` Pool driver (needed for row-locking transactions). Better Auth handles sessions, Google OAuth and magic links; authorization is enforced server-side by `requireUser()` / `requireCouple()`, with `src/proxy.ts` doing only optimistic redirects.

**Tech Stack:** Next.js 16.3.5 · React 19 · TypeScript · Tailwind CSS v4 · shadcn/ui · Better Auth 1.7.4 · Drizzle ORM 0.45.2 / drizzle-kit 0.31.10 · @neondatabase/serverless 1.1.0 · Resend 6.28.0 · Zod 4.6.4 · Vitest 5.0.0 · Playwright 1.63.0 · Node 24

**Spec:** `docs/superpowers/specs/2026-09-13-duo-foundation-design.md`

## Global Constraints

- Pin these exact versions: `next@16.3.5`, `better-auth@1.7.4`, `drizzle-orm@0.45.2`, `drizzle-kit@0.31.10`, `@neondatabase/serverless@1.1.0`, `resend@6.28.0`, `zod@4.6.4`, `vitest@5.0.0`, `@playwright/test@1.63.0`.
- Next.js 16 conventions: request interception lives in `src/proxy.ts` exporting `proxy` (there is no `middleware.ts`); `params`, `searchParams`, `cookies()` and `headers()` are all async and must be awaited.
- Every couple-scoped read or write gets `coupleId` from `requireCouple()` / the signed-in user on the server — never from client input.
- A user belongs to at most one couple; a couple has at most 2 members.
- Display name: trimmed, 1–40 characters. `together_since`: a valid `YYYY-MM-DD` date, not after today in the viewer's time zone.
- Invite links expire after 7 days, are single-use, and creating a new one revokes the previous one. Magic links expire after 15 minutes.
- Time zone for day counts comes from the `tz` cookie; unknown or missing → `UTC`.
- Visual system: background `#FBF8F3`, text `#1F1B16`, peach `#FFD8C2`, lilac `#E3DAFF`, mint `#CFF0DE`, butter `#FFF1B8`; cards `rounded-3xl`; display font Bricolage Grotesque, body font Inter; mobile-first, content max width 480px; light mode only.
- Tests run against a Neon **test branch** via `TEST_DATABASE_URL`. Test helpers refuse to truncate any other database.
- `EMAIL_TRANSPORT=file` (write magic links to `.e2e-mail/`) is for local dev and e2e only and is ignored when `VERCEL_ENV=production`.
- No Phase 2–5 features, no unpairing, no profile editing, no push notifications, no dark mode.

## Prerequisites (human, before Task 3)

These need the project owner's accounts. If any are missing when a task needs them, stop and ask.

1. Create a Neon project named `duo`. It comes with a `main` branch — use it for local development. Create a second branch named `test` from `main`.
2. Copy each branch's **pooled** connection string from the Neon console.
3. After Task 1 creates `.env.example`, create `.env.local`:
   ```
   DATABASE_URL=<Neon main branch pooled URL>
   BETTER_AUTH_SECRET=<output of: openssl rand -base64 32>
   EMAIL_TRANSPORT=file
   ```
4. Create `.env.test.local`:
   ```
   TEST_DATABASE_URL=<Neon test branch pooled URL>
   ```
5. Optional for local dev (required before Task 13): a Google OAuth client (Task 13 has the steps) and a Resend account with a verified sending domain.

## File Map

```
.env.example                          env var template (committed)
vercel.json                           build command runs migrations first
drizzle.config.ts                     drizzle-kit config
drizzle/                              generated SQL migrations
scripts/migrate.ts                    CLI entry: apply migrations to DATABASE_URL
vitest.config.ts                      unit/integration test config
playwright.config.ts                  e2e config
public/icon.svg                       PWA icon
src/proxy.ts                          optimistic redirect to /sign-in
src/db/schema.ts                      all tables (Better Auth + app)
src/db/index.ts                       Pool, db, DbExecutor type
src/db/run-migrations.ts              runMigrations(url)
src/db/errors.ts                      isUniqueViolation(err)
src/lib/dates.ts                      todayInTimeZone, daysTogether
src/lib/timezone.ts                   TZ_COOKIE, getViewerTimeZone (server)
src/lib/app-url.ts                    appUrl()
src/lib/validation.ts                 nameSchema, togetherSinceSchema
src/lib/invites.ts                    invite create/lookup/accept domain logic
src/lib/couples.ts                    createCouple, getCoupleForUser
src/lib/email.ts                      sendMagicLinkEmail (Resend or file)
src/lib/redirects.ts                  safeCallbackPath
src/lib/auth.ts                       Better Auth server instance
src/lib/auth-client.ts                Better Auth React client
src/lib/session.ts                    getSession, requireUser, requireCouple
src/lib/invite-messages.ts            copy for each invite problem
src/components/ui/*                   shadcn button, input, label (restyled via tokens)
src/components/timezone-cookie.tsx    sets tz cookie client-side
src/components/sign-in-form.tsx       magic link + Google form
src/components/sign-out-button.tsx
src/components/onboarding-form.tsx
src/components/waiting-for-partner.tsx
src/components/couple-hero.tsx
src/components/invite-problem.tsx
src/components/accept-invite-form.tsx
src/app/layout.tsx, globals.css, page.tsx, manifest.ts, error.tsx, not-found.tsx
src/app/api/auth/[...all]/route.ts
src/app/(auth)/sign-in/page.tsx
src/app/(auth)/check-email/page.tsx
src/app/onboarding/page.tsx, actions.ts
src/app/(app)/home/page.tsx, actions.ts
src/app/invite/[token]/page.tsx, actions.ts
tests/helpers/reset-sql.ts, tests/helpers/db.ts
tests/global-setup.ts, tests/setup.ts
tests/unit/*.test.ts
tests/e2e/global-setup.ts, tests/e2e/pairing.spec.ts
```

---

### Task 1: Scaffold the Next.js 16 project

**Files:**
- Create: everything generated by `create-next-app`, `.env.example`, `vercel.json`
- Modify: `.gitignore`, `package.json`

**Interfaces:**
- Consumes: nothing
- Produces: a building Next.js 16 app with `src/` dir, `@/*` alias, Tailwind v4, ESLint; npm scripts `dev`, `build`, `lint`, `test`, `test:e2e`, `db:generate`, `db:migrate`

- [ ] **Step 1: Generate the app into a temp folder and move it in**

The repo root already contains `docs/` and `.git`, so scaffold beside it and copy over.

```bash
cd /home/ubuntu/duo-workspace
npx -y create-next-app@16.3.5 duo-scaffold --ts --tailwind --eslint --app --src-dir \
  --import-alias "@/*" --use-npm --disable-git --yes
cp -r duo-scaffold/. .
rm -rf duo-scaffold
```

Expected: `package.json`, `src/app/page.tsx`, `next.config.ts`, `tsconfig.json` exist at the repo root.

- [ ] **Step 2: Install dependencies**

```bash
npm i better-auth@1.7.4 drizzle-orm@0.45.2 @neondatabase/serverless@1.1.0 resend@6.28.0 zod@4.6.4 server-only
npm i -D drizzle-kit@0.31.10 vitest@5.0.0 @playwright/test@1.63.0 tsx dotenv
```

- [ ] **Step 3: Add npm scripts**

```bash
npm pkg set scripts.test="vitest run" \
  scripts.test:e2e="playwright test" \
  scripts.db:generate="drizzle-kit generate" \
  scripts.db:migrate="tsx scripts/migrate.ts"
```

- [ ] **Step 4: Update `.gitignore`**

`create-next-app` ignores `.env*`. Append these lines to the end of `.gitignore`:

```
!.env.example
.e2e-mail/
playwright-report/
test-results/
```

- [ ] **Step 5: Create `.env.example`**

```bash
# --- .env.local (local dev) ---
# Neon pooled connection string (use the "main" branch locally)
DATABASE_URL=
# openssl rand -base64 32
BETTER_AUTH_SECRET=
# Set in Vercel Production only. Local defaults to http://localhost:3000; previews use VERCEL_URL.
BETTER_AUTH_URL=
# Optional locally. Set for Production + Development in Vercel only (Google rejects preview URLs).
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
# Required in Vercel. Not needed locally when EMAIL_TRANSPORT=file.
RESEND_API_KEY=
EMAIL_FROM="Duo <hello@yourdomain.com>"
# "file" writes magic links to .e2e-mail/<email>.txt instead of emailing (local dev + e2e only)
EMAIL_TRANSPORT=file

# --- .env.test.local (tests) ---
# Neon "test" branch pooled connection string. Tests TRUNCATE this database.
TEST_DATABASE_URL=
```

- [ ] **Step 6: Create `vercel.json`**

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npm run db:migrate && npm run build"
}
```

- [ ] **Step 7: Verify it builds and lints**

Run: `npm run build && npm run lint`
Expected: build finishes with the route table printed; lint exits 0.

- [ ] **Step 8: Commit**

```bash
git add -A
git status --short   # confirm no .env.local / .env.test.local is staged
git commit -m "chore: scaffold Next.js 16 app with tooling"
```

---

### Task 2: Date helpers and Vitest setup

**Files:**
- Create: `vitest.config.ts`, `src/lib/dates.ts`
- Test: `tests/unit/dates.test.ts`

**Interfaces:**
- Consumes: nothing
- Produces:
  - `todayInTimeZone(timeZone: string, now?: Date): string` — `"YYYY-MM-DD"` in that zone; invalid zone → UTC
  - `daysTogether(togetherSince: string, timeZone: string, now?: Date): number` — whole days, never negative

- [ ] **Step 1: Create `vitest.config.ts`**

```ts
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

loadEnv({ path: ".env.test.local", quiet: true });

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
  },
});
```

- [ ] **Step 2: Write the failing test** — `tests/unit/dates.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { daysTogether, todayInTimeZone } from "@/lib/dates";

const NOW = new Date("2026-09-13T15:00:00Z");

describe("todayInTimeZone", () => {
  it("returns the calendar date in the given time zone", () => {
    expect(todayInTimeZone("UTC", NOW)).toBe("2026-09-13");
    expect(todayInTimeZone("Australia/Sydney", NOW)).toBe("2026-09-14");
    expect(todayInTimeZone("America/Los_Angeles", NOW)).toBe("2026-09-13");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(todayInTimeZone("Not/AZone", NOW)).toBe("2026-09-13");
  });
});

describe("daysTogether", () => {
  it("is 0 on the first day", () => {
    expect(daysTogether("2026-09-13", "UTC", NOW)).toBe(0);
  });

  it("counts whole days", () => {
    expect(daysTogether("2024-05-10", "UTC", NOW)).toBe(856);
  });

  it("uses the viewer's time zone", () => {
    expect(daysTogether("2026-09-13", "Australia/Sydney", NOW)).toBe(1);
    expect(daysTogether("2026-09-13", "America/Los_Angeles", NOW)).toBe(0);
  });

  it("never goes negative for a future date", () => {
    expect(daysTogether("2026-12-25", "UTC", NOW)).toBe(0);
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/dates.test.ts`
Expected: FAIL, cannot resolve `@/lib/dates`.

- [ ] **Step 4: Implement** — `src/lib/dates.ts`

```ts
const MS_PER_DAY = 86_400_000;

export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: resolveTimeZone(timeZone),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function daysTogether(togetherSince: string, timeZone: string, now: Date = new Date()): number {
  const diff = toUtcMs(todayInTimeZone(timeZone, now)) - toUtcMs(togetherSince);
  return Math.max(0, Math.round(diff / MS_PER_DAY));
}

function resolveTimeZone(timeZone: string): string {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
    return timeZone;
  } catch {
    return "UTC";
  }
}

function toUtcMs(isoDate: string): number {
  const [year, month, day] = isoDate.split("-").map(Number);
  return Date.UTC(year, month - 1, day);
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/dates.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 6: Commit**

```bash
git add vitest.config.ts src/lib/dates.ts tests/unit/dates.test.ts
git commit -m "feat: add time-zone aware day counting"
```

---

### Task 3: Database schema, client, migrations and test harness

**Files:**
- Create: `src/db/schema.ts`, `src/db/index.ts`, `src/db/run-migrations.ts`, `drizzle.config.ts`, `scripts/migrate.ts`, `drizzle/*` (generated), `tests/helpers/reset-sql.ts`, `tests/helpers/db.ts`, `tests/global-setup.ts`, `tests/setup.ts`
- Modify: `vitest.config.ts`
- Test: `tests/unit/schema.test.ts`

**Interfaces:**
- Consumes: `.env.local` (`DATABASE_URL`), `.env.test.local` (`TEST_DATABASE_URL`) — see Prerequisites
- Produces:
  - Tables `user`, `session`, `account`, `verification`, `couples`, `coupleMembers`, `coupleInvites` exported from `@/db/schema`
  - `db` (Drizzle instance), `pool`, `type Db`, `type DbExecutor` (accepted by functions that may run inside a transaction) from `@/db`
  - `runMigrations(connectionString: string): Promise<void>` from `@/db/run-migrations`
  - Test helpers from `tests/helpers/db.ts`: `resetDb(): Promise<void>`, `createTestUser(overrides?: { name?: string; email?: string }): Promise<typeof user.$inferSelect>`
  - `RESET_SQL: string` from `tests/helpers/reset-sql.ts`

- [ ] **Step 1: Check prerequisites**

Run: `test -f .env.local && grep -q '^DATABASE_URL=.\+' .env.local && test -f .env.test.local && grep -q '^TEST_DATABASE_URL=.\+' .env.test.local && echo OK`
Expected: `OK`. If not, stop and ask the project owner to complete the Prerequisites section.

- [ ] **Step 2: Write the schema** — `src/db/schema.ts`

Better Auth's core tables must have these exact JS property names (the adapter maps by property name).

```ts
import { boolean, date, index, pgTable, primaryKey, text, timestamp } from "drizzle-orm/pg-core";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () =>
  timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date());

// ---- Better Auth core tables ----

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at", { withTimezone: true }),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at", { withTimezone: true }),
  scope: text("scope"),
  password: text("password"),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

// ---- Duo tables ----

export const couples = pgTable("couples", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  togetherSince: date("together_since", { mode: "string" }).notNull(),
  createdAt: createdAt(),
});

export const coupleMembers = pgTable(
  "couple_members",
  {
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .unique()
      .references(() => user.id, { onDelete: "cascade" }),
    joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.coupleId, t.userId] })],
);

export const coupleInvites = pgTable(
  "couple_invites",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    coupleId: text("couple_id")
      .notNull()
      .references(() => couples.id, { onDelete: "cascade" }),
    createdBy: text("created_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    token: text("token").notNull().unique(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    usedAt: timestamp("used_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index("couple_invites_couple_id_idx").on(t.coupleId)],
);
```

- [ ] **Step 3: Write the client** — `src/db/index.ts`

```ts
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString });
export const db = drizzle({ client: pool, schema });

export type Db = typeof db;
// Satisfied by both `db` and a transaction `tx`.
export type DbExecutor = Pick<Db, "select" | "insert" | "update" | "delete">;
```

- [ ] **Step 4: Write the migration runner** — `src/db/run-migrations.ts`

```ts
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

export async function runMigrations(connectionString: string): Promise<void> {
  const pool = new Pool({ connectionString });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "drizzle" });
  } finally {
    await pool.end();
  }
}
```

- [ ] **Step 5: Write `scripts/migrate.ts`**

```ts
import { loadEnvConfig } from "@next/env";
import { runMigrations } from "../src/db/run-migrations";

loadEnvConfig(process.cwd());

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set");
  process.exit(1);
}

runMigrations(url).then(
  () => console.log("Migrations applied"),
  (error) => {
    console.error(error);
    process.exit(1);
  },
);
```

- [ ] **Step 6: Write `drizzle.config.ts`**

```ts
import { loadEnvConfig } from "@next/env";
import { defineConfig } from "drizzle-kit";

loadEnvConfig(process.cwd());

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
```

- [ ] **Step 7: Generate the migration and apply it to the dev branch**

```bash
npm run db:generate
npm run db:migrate
```

Expected: a new `drizzle/0000_*.sql` containing `CREATE TABLE "couples"`, `"couple_members"`, `"couple_invites"`, `"user"`, `"session"`, `"account"`, `"verification"`; then `Migrations applied`.

- [ ] **Step 8: Write the test harness**

`tests/helpers/reset-sql.ts`:

```ts
export const RESET_SQL =
  'TRUNCATE couple_invites, couple_members, couples, session, account, verification, "user" CASCADE';
```

`tests/helpers/db.ts`:

```ts
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { user } from "@/db/schema";
import { RESET_SQL } from "./reset-sql";

export async function resetDb(): Promise<void> {
  if (!process.env.TEST_DATABASE_URL || process.env.DATABASE_URL !== process.env.TEST_DATABASE_URL) {
    throw new Error("Refusing to reset a database that is not TEST_DATABASE_URL");
  }
  await db.execute(sql.raw(RESET_SQL));
}

export async function createTestUser(overrides: { name?: string; email?: string } = {}) {
  const id = crypto.randomUUID();
  const [row] = await db
    .insert(user)
    .values({
      id,
      name: overrides.name ?? "",
      email: overrides.email ?? `${id}@duo.test`,
      emailVerified: true,
    })
    .returning();
  return row;
}
```

`tests/global-setup.ts`:

```ts
import { runMigrations } from "../src/db/run-migrations";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test.local");
  }
  await runMigrations(url);
}
```

`tests/setup.ts`:

```ts
import { afterAll } from "vitest";
import { pool } from "@/db";

afterAll(async () => {
  await pool.end();
});
```

- [ ] **Step 9: Point Vitest at the test database** — replace the `test` block in `vitest.config.ts`

```ts
  test: {
    include: ["tests/unit/**/*.test.ts"],
    environment: "node",
    fileParallelism: false,
    globalSetup: ["tests/global-setup.ts"],
    setupFiles: ["tests/setup.ts"],
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "" },
    testTimeout: 20_000,
    hookTimeout: 60_000,
  },
```

- [ ] **Step 10: Write the failing schema test** — `tests/unit/schema.test.ts`

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleMembers, couples } from "@/db/schema";
import { createTestUser, resetDb } from "../helpers/db";

describe("database schema", () => {
  beforeEach(resetDb);

  it("stores together_since as a YYYY-MM-DD string", async () => {
    const [couple] = await db.insert(couples).values({ togetherSince: "2024-05-10" }).returning();
    const [row] = await db.select().from(couples).where(eq(couples.id, couple.id));
    expect(row.togetherSince).toBe("2024-05-10");
  });

  it("lets a user belong to only one couple", async () => {
    const member = await createTestUser();
    const [first] = await db.insert(couples).values({ togetherSince: "2024-05-10" }).returning();
    const [second] = await db.insert(couples).values({ togetherSince: "2024-05-10" }).returning();
    await db.insert(coupleMembers).values({ coupleId: first.id, userId: member.id });

    await expect(
      db.insert(coupleMembers).values({ coupleId: second.id, userId: member.id }),
    ).rejects.toThrow();
  });
});
```

- [ ] **Step 11: Run all unit tests**

Run: `npm test`
Expected: PASS — `dates.test.ts` (6) and `schema.test.ts` (2). The first run applies migrations to the test branch.

(There is no separate "fails first" run here: the schema already exists from Step 2. If either test fails, the schema or harness is wrong — fix before moving on.)

- [ ] **Step 12: Commit**

```bash
git add src/db drizzle drizzle.config.ts scripts tests vitest.config.ts
git commit -m "feat: add database schema, migrations and test harness"
```

---

### Task 4: Invite creation

**Files:**
- Create: `src/lib/app-url.ts`, `src/lib/invites.ts`
- Modify: `tests/helpers/db.ts` (add `createTestCouple`)
- Test: `tests/unit/invites-create.test.ts`

**Interfaces:**
- Consumes: `db`, `DbExecutor` from `@/db`; `coupleInvites`, `couples`, `coupleMembers` from `@/db/schema`; `resetDb`, `createTestUser`
- Produces:
  - `appUrl(): string` — `BETTER_AUTH_URL` (trailing slash removed) → `https://${VERCEL_URL}` → `http://localhost:3000`
  - `INVITE_TTL_MS: number` (7 days)
  - `type Invite = typeof coupleInvites.$inferSelect`
  - `createInvite(exec: DbExecutor, params: { coupleId: string; createdBy: string; now?: Date }): Promise<Invite>` — revokes the couple's other open invites first
  - `getActiveInvite(coupleId: string, now?: Date): Promise<Invite | null>`
  - `inviteUrl(token: string): string`
  - Test helper `createTestCouple(userId: string, togetherSince?: string): Promise<string>` — returns couple id

- [ ] **Step 1: Add the test helper** — append to `tests/helpers/db.ts`

Also add `coupleMembers, couples` to the existing `@/db/schema` import at the top of the file.

```ts
export async function createTestCouple(userId: string, togetherSince = "2024-05-10"): Promise<string> {
  const [couple] = await db.insert(couples).values({ togetherSince }).returning({ id: couples.id });
  await db.insert(coupleMembers).values({ coupleId: couple.id, userId });
  return couple.id;
}
```

- [ ] **Step 2: Write the failing test** — `tests/unit/invites-create.test.ts`

```ts
import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { db } from "@/db";
import { coupleInvites } from "@/db/schema";
import { INVITE_TTL_MS, createInvite, getActiveInvite, inviteUrl } from "@/lib/invites";
import { createTestCouple, createTestUser, resetDb } from "../helpers/db";

describe("createInvite", () => {
  beforeEach(resetDb);

  it("creates a URL-safe token that expires in 7 days", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);
    const now = new Date("2026-09-13T10:00:00Z");

    const invite = await createInvite(db, { coupleId, createdBy: inviter.id, now });

    expect(invite.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(invite.expiresAt.getTime()).toBe(now.getTime() + INVITE_TTL_MS);
    expect(invite.usedAt).toBeNull();
    expect(invite.revokedAt).toBeNull();
  });

  it("revokes the previous open invite", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);

    const first = await createInvite(db, { coupleId, createdBy: inviter.id });
    const second = await createInvite(db, { coupleId, createdBy: inviter.id });

    const [firstRow] = await db.select().from(coupleInvites).where(eq(coupleInvites.id, first.id));
    expect(firstRow.revokedAt).not.toBeNull();
    expect((await getActiveInvite(coupleId))?.id).toBe(second.id);
  });
});

describe("getActiveInvite", () => {
  beforeEach(resetDb);

  it("ignores expired invites", async () => {
    const inviter = await createTestUser();
    const coupleId = await createTestCouple(inviter.id);
    await createInvite(db, {
      coupleId,
      createdBy: inviter.id,
      now: new Date(Date.now() - INVITE_TTL_MS - 60_000),
    });

    expect(await getActiveInvite(coupleId)).toBeNull();
  });
});

describe("inviteUrl", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("builds an absolute link from BETTER_AUTH_URL", () => {
    vi.stubEnv("BETTER_AUTH_URL", "https://duo.example/");
    expect(inviteUrl("abc")).toBe("https://duo.example/invite/abc");
  });
});
```

- [ ] **Step 3: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/invites-create.test.ts`
Expected: FAIL, cannot resolve `@/lib/invites`.

- [ ] **Step 4: Implement** — `src/lib/app-url.ts`

```ts
export function appUrl(): string {
  if (process.env.BETTER_AUTH_URL) return process.env.BETTER_AUTH_URL.replace(/\/+$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
```

`src/lib/invites.ts`:

```ts
import { randomBytes } from "node:crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { coupleInvites } from "@/db/schema";
import { appUrl } from "@/lib/app-url";

export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export type Invite = typeof coupleInvites.$inferSelect;

export async function createInvite(
  exec: DbExecutor,
  params: { coupleId: string; createdBy: string; now?: Date },
): Promise<Invite> {
  const now = params.now ?? new Date();

  await exec
    .update(coupleInvites)
    .set({ revokedAt: now })
    .where(
      and(
        eq(coupleInvites.coupleId, params.coupleId),
        isNull(coupleInvites.usedAt),
        isNull(coupleInvites.revokedAt),
      ),
    );

  const [invite] = await exec
    .insert(coupleInvites)
    .values({
      coupleId: params.coupleId,
      createdBy: params.createdBy,
      token: randomBytes(32).toString("base64url"),
      expiresAt: new Date(now.getTime() + INVITE_TTL_MS),
      createdAt: now,
    })
    .returning();

  return invite;
}

export async function getActiveInvite(coupleId: string, now: Date = new Date()): Promise<Invite | null> {
  const [invite] = await db
    .select()
    .from(coupleInvites)
    .where(
      and(
        eq(coupleInvites.coupleId, coupleId),
        isNull(coupleInvites.usedAt),
        isNull(coupleInvites.revokedAt),
        gt(coupleInvites.expiresAt, now),
      ),
    )
    .orderBy(desc(coupleInvites.createdAt))
    .limit(1);

  return invite ?? null;
}

export function inviteUrl(token: string): string {
  return `${appUrl()}/invite/${token}`;
}
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/invites-create.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 6: Commit**

```bash
git add src/lib/app-url.ts src/lib/invites.ts tests
git commit -m "feat: create and revoke couple invites"
```

---

### Task 5: Couple creation and lookup

**Files:**
- Create: `src/lib/validation.ts`, `src/db/errors.ts`, `src/lib/couples.ts`
- Test: `tests/unit/couples.test.ts`

**Interfaces:**
- Consumes: `createInvite`, `getActiveInvite` from `@/lib/invites`; `todayInTimeZone` from `@/lib/dates`; `db`; schema tables; `resetDb`, `createTestUser`, `createTestCouple`
- Produces:
  - `nameSchema` (Zod: trimmed string, 1–40), `togetherSinceSchema` (Zod ISO date) from `@/lib/validation`
  - `isUniqueViolation(err: unknown): boolean` from `@/db/errors`
  - From `@/lib/couples`:
    - `type CreateCoupleInput = { name: string; togetherSince: string }`
    - `type CreateCoupleResult = { ok: true; coupleId: string } | { ok: false; reason: "invalid_input"; fieldErrors: { name?: string; togetherSince?: string } } | { ok: false; reason: "already_in_couple" }`
    - `createCouple(userId: string, input: CreateCoupleInput, timeZone: string): Promise<CreateCoupleResult>`
    - `type CoupleMember = { id: string; name: string; image: string | null }`
    - `type CoupleWithMembers = { id: string; togetherSince: string; members: CoupleMember[] }` — members ordered by join time
    - `getCoupleForUser(userId: string): Promise<CoupleWithMembers | null>`

- [ ] **Step 1: Write the failing test** — `tests/unit/couples.test.ts`

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleMembers, user } from "@/db/schema";
import { createCouple, getCoupleForUser } from "@/lib/couples";
import { getActiveInvite } from "@/lib/invites";
import { createTestUser, resetDb } from "../helpers/db";

describe("createCouple", () => {
  beforeEach(resetDb);

  it("creates the couple, adds the user, sets their name and opens an invite", async () => {
    const me = await createTestUser();

    const result = await createCouple(me.id, { name: "  Jaffran  ", togetherSince: "2024-05-10" }, "UTC");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const couple = await getCoupleForUser(me.id);
    expect(couple).toEqual({
      id: result.coupleId,
      togetherSince: "2024-05-10",
      members: [{ id: me.id, name: "Jaffran", image: null }],
    });
    expect(await getActiveInvite(result.coupleId)).not.toBeNull();
  });

  it("rejects a blank name", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "   ", togetherSince: "2024-05-10" }, "UTC");
    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      fieldErrors: { name: "Tell us what to call you", togetherSince: undefined },
    });
  });

  it("rejects a name longer than 40 characters", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "a".repeat(41), togetherSince: "2024-05-10" }, "UTC");
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.name).toBe(
      "Keep it under 40 characters",
    );
  });

  it("rejects an invalid date", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "Jaffran", togetherSince: "not-a-date" }, "UTC");
    expect(result.ok === false && result.reason === "invalid_input" && result.fieldErrors.togetherSince).toBe(
      "Pick a valid date",
    );
  });

  it("rejects a date in the future", async () => {
    const me = await createTestUser();
    const result = await createCouple(me.id, { name: "Jaffran", togetherSince: "2999-01-01" }, "UTC");
    expect(result).toEqual({
      ok: false,
      reason: "invalid_input",
      fieldErrors: { togetherSince: "That date is in the future" },
    });
  });

  it("refuses a user who is already in a couple and leaves their data unchanged", async () => {
    const me = await createTestUser();
    await createCouple(me.id, { name: "Jaffran", togetherSince: "2024-05-10" }, "UTC");

    const second = await createCouple(me.id, { name: "Someone Else", togetherSince: "2025-01-01" }, "UTC");

    expect(second).toEqual({ ok: false, reason: "already_in_couple" });
    const [row] = await db.select().from(user).where(eq(user.id, me.id));
    expect(row.name).toBe("Jaffran");
    expect(await db.select().from(coupleMembers)).toHaveLength(1);
  });
});

describe("getCoupleForUser", () => {
  beforeEach(resetDb);

  it("returns null for a user without a couple", async () => {
    const me = await createTestUser();
    expect(await getCoupleForUser(me.id)).toBeNull();
  });

  it("lists members in the order they joined", async () => {
    const first = await createTestUser({ name: "Jaffran" });
    const second = await createTestUser({ name: "Sarah" });
    const result = await createCouple(first.id, { name: "Jaffran", togetherSince: "2024-05-10" }, "UTC");
    if (!result.ok) throw new Error("setup failed");
    await db.insert(coupleMembers).values({ coupleId: result.coupleId, userId: second.id });

    const couple = await getCoupleForUser(second.id);

    expect(couple?.members.map((m) => m.name)).toEqual(["Jaffran", "Sarah"]);
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/couples.test.ts`
Expected: FAIL, cannot resolve `@/lib/couples`.

- [ ] **Step 3: Implement** — `src/lib/validation.ts`

```ts
import { z } from "zod";

export const nameSchema = z
  .string()
  .trim()
  .min(1, "Tell us what to call you")
  .max(40, "Keep it under 40 characters");

export const togetherSinceSchema = z.iso.date("Pick a valid date");
```

`src/db/errors.ts`:

```ts
// Postgres unique_violation. Drizzle may wrap driver errors, so walk the cause chain.
export function isUniqueViolation(err: unknown): boolean {
  let current: unknown = err;
  while (current && typeof current === "object") {
    if ((current as { code?: unknown }).code === "23505") return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}
```

`src/lib/couples.ts`:

```ts
import { asc, eq } from "drizzle-orm";
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

export async function getCoupleForUser(userId: string): Promise<CoupleWithMembers | null> {
  const [membership] = await db
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  if (!membership) return null;

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
    .where(eq(couples.id, membership.coupleId))
    .orderBy(asc(coupleMembers.joinedAt));

  return {
    id: rows[0].coupleId,
    togetherSince: rows[0].togetherSince,
    members: rows.map((row) => ({ id: row.memberId, name: row.memberName, image: row.memberImage })),
  };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/couples.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all tests pass; no type errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/validation.ts src/db/errors.ts src/lib/couples.ts tests/unit/couples.test.ts
git commit -m "feat: create couples and look them up by member"
```

---

### Task 6: Invite inspection and acceptance

**Files:**
- Modify: `src/lib/invites.ts`
- Test: `tests/unit/invites-accept.test.ts`

**Interfaces:**
- Consumes: `nameSchema` from `@/lib/validation`; `isUniqueViolation` from `@/db/errors`; `createInvite`; `createCouple`, `getCoupleForUser` (tests only)
- Produces (all from `@/lib/invites`):
  - `type InviteProblem = "not_found" | "expired" | "used" | "own_invite" | "already_paired" | "couple_full"`
  - `type InviteView = { ok: true; inviterName: string } | { ok: false; reason: InviteProblem }`
  - `type AcceptInviteResult = { ok: true; coupleId: string } | { ok: false; reason: InviteProblem } | { ok: false; reason: "invalid_name"; message: string }`
  - `getInvitePreview(token: string): Promise<{ inviterName: string } | null>` — for signed-out visitors; null when unknown or revoked
  - `getInviteView(token: string, userId: string, now?: Date): Promise<InviteView>`
  - `acceptInvite(token: string, params: { userId: string; name: string; now?: Date }): Promise<AcceptInviteResult>`

Problem precedence (first match wins): `not_found` (unknown or revoked) → `own_invite` → `used` → `expired` → `already_paired` → `couple_full`.

- [ ] **Step 1: Write the failing test** — `tests/unit/invites-accept.test.ts`

```ts
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { coupleInvites, coupleMembers, user } from "@/db/schema";
import { createCouple, getCoupleForUser } from "@/lib/couples";
import {
  INVITE_TTL_MS,
  acceptInvite,
  createInvite,
  getActiveInvite,
  getInvitePreview,
  getInviteView,
} from "@/lib/invites";
import { createTestUser, resetDb } from "../helpers/db";

async function coupleWithInvite(inviterName = "Jaffran") {
  const inviter = await createTestUser();
  const result = await createCouple(inviter.id, { name: inviterName, togetherSince: "2024-05-10" }, "UTC");
  if (!result.ok) throw new Error("setup failed");
  const invite = await getActiveInvite(result.coupleId);
  if (!invite) throw new Error("setup failed: no invite");
  return { inviter, coupleId: result.coupleId, invite };
}

describe("getInvitePreview", () => {
  beforeEach(resetDb);

  it("returns the inviter's name for a known invite", async () => {
    const { invite } = await coupleWithInvite();
    expect(await getInvitePreview(invite.token)).toEqual({ inviterName: "Jaffran" });
  });

  it("returns null for unknown or malformed tokens", async () => {
    expect(await getInvitePreview("x".repeat(43))).toBeNull();
    expect(await getInvitePreview("../../etc")).toBeNull();
  });
});

describe("getInviteView", () => {
  beforeEach(resetDb);

  it("is ok for a fresh invite and a user without a couple", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    expect(await getInviteView(invite.token, partner.id)).toEqual({ ok: true, inviterName: "Jaffran" });
  });

  it("reports not_found for unknown and revoked invites", async () => {
    const { inviter, coupleId, invite } = await coupleWithInvite();
    const partner = await createTestUser();
    expect(await getInviteView("x".repeat(43), partner.id)).toEqual({ ok: false, reason: "not_found" });

    await createInvite(db, { coupleId, createdBy: inviter.id });
    expect(await getInviteView(invite.token, partner.id)).toEqual({ ok: false, reason: "not_found" });
  });

  it("reports own_invite to the inviter", async () => {
    const { inviter, invite } = await coupleWithInvite();
    expect(await getInviteView(invite.token, inviter.id)).toEqual({ ok: false, reason: "own_invite" });
  });

  it("reports expired after 7 days", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    const later = new Date(invite.expiresAt.getTime() + 1);
    expect(await getInviteView(invite.token, partner.id, later)).toEqual({ ok: false, reason: "expired" });
  });

  it("reports used once someone has joined", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();
    const stranger = await createTestUser();
    await acceptInvite(invite.token, { userId: partner.id, name: "Sarah" });
    expect(await getInviteView(invite.token, stranger.id)).toEqual({ ok: false, reason: "used" });
  });

  it("reports already_paired when the visitor has a couple", async () => {
    const { invite } = await coupleWithInvite();
    const other = await createTestUser();
    await createCouple(other.id, { name: "Other", togetherSince: "2023-01-01" }, "UTC");
    expect(await getInviteView(invite.token, other.id)).toEqual({ ok: false, reason: "already_paired" });
  });

  it("reports couple_full when the couple already has two members", async () => {
    const { inviter, coupleId } = await coupleWithInvite();
    const partner = await createTestUser();
    await db.insert(coupleMembers).values({ coupleId, userId: partner.id });
    const extra = await createInvite(db, { coupleId, createdBy: inviter.id });
    const stranger = await createTestUser();
    expect(await getInviteView(extra.token, stranger.id)).toEqual({ ok: false, reason: "couple_full" });
  });
});

describe("acceptInvite", () => {
  beforeEach(resetDb);

  it("joins the couple, marks the invite used and saves the name", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, { userId: partner.id, name: " Sarah " });

    expect(result).toEqual({ ok: true, coupleId });
    const couple = await getCoupleForUser(partner.id);
    expect(couple?.members.map((m) => m.name)).toEqual(["Jaffran", "Sarah"]);
    const [inviteRow] = await db.select().from(coupleInvites).where(eq(coupleInvites.id, invite.id));
    expect(inviteRow.usedAt).not.toBeNull();
  });

  it("rejects an invalid name without joining", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, { userId: partner.id, name: "" });

    expect(result).toEqual({ ok: false, reason: "invalid_name", message: "Tell us what to call you" });
    expect(await getCoupleForUser(partner.id)).toBeNull();
  });

  it("re-checks expiry at accept time", async () => {
    const { invite } = await coupleWithInvite();
    const partner = await createTestUser();

    const result = await acceptInvite(invite.token, {
      userId: partner.id,
      name: "Sarah",
      now: new Date(Date.now() + INVITE_TTL_MS + 60_000),
    });

    expect(result).toEqual({ ok: false, reason: "expired" });
    expect(await getCoupleForUser(partner.id)).toBeNull();
  });

  it("lets exactly one of two people accept the same invite at once", async () => {
    const { coupleId, invite } = await coupleWithInvite();
    const first = await createTestUser();
    const second = await createTestUser();

    const results = await Promise.all([
      acceptInvite(invite.token, { userId: first.id, name: "First" }),
      acceptInvite(invite.token, { userId: second.id, name: "Second" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "used" }]);
    const members = await db.select().from(coupleMembers).where(eq(coupleMembers.coupleId, coupleId));
    expect(members).toHaveLength(2);
  });

  it("lets one person join only one of two couples at once", async () => {
    const a = await coupleWithInvite("A");
    const b = await coupleWithInvite("B");
    const partner = await createTestUser();

    const results = await Promise.all([
      acceptInvite(a.invite.token, { userId: partner.id, name: "Sarah" }),
      acceptInvite(b.invite.token, { userId: partner.id, name: "Sarah" }),
    ]);

    expect(results.filter((r) => r.ok)).toHaveLength(1);
    expect(results.filter((r) => !r.ok)).toEqual([{ ok: false, reason: "already_paired" }]);
    const [row] = await db.select().from(user).where(eq(user.id, partner.id));
    expect(row.name).toBe("Sarah");
  });
});
```

- [ ] **Step 2: Run the test to confirm it fails**

Run: `npx vitest run tests/unit/invites-accept.test.ts`
Expected: FAIL, `acceptInvite` / `getInviteView` / `getInvitePreview` are not exported.

- [ ] **Step 3: Implement** — edit `src/lib/invites.ts`

Replace the import block at the top with:

```ts
import { randomBytes } from "node:crypto";
import { and, count, desc, eq, gt, isNull } from "drizzle-orm";
import { db, type DbExecutor } from "@/db";
import { isUniqueViolation } from "@/db/errors";
import { coupleInvites, coupleMembers, couples, user } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { nameSchema } from "@/lib/validation";
```

Append to the end of the file:

```ts
export type InviteProblem = "not_found" | "expired" | "used" | "own_invite" | "already_paired" | "couple_full";

export type InviteView = { ok: true; inviterName: string } | { ok: false; reason: InviteProblem };

export type AcceptInviteResult =
  | { ok: true; coupleId: string }
  | { ok: false; reason: InviteProblem }
  | { ok: false; reason: "invalid_name"; message: string };

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{16,128}$/;

async function loadInvite(exec: DbExecutor, token: string) {
  const [row] = await exec
    .select({ invite: coupleInvites, inviterName: user.name })
    .from(coupleInvites)
    .innerJoin(user, eq(user.id, coupleInvites.createdBy))
    .where(eq(coupleInvites.token, token))
    .limit(1);
  return row ?? null;
}

async function countMembers(exec: DbExecutor, coupleId: string): Promise<number> {
  const [row] = await exec
    .select({ value: count() })
    .from(coupleMembers)
    .where(eq(coupleMembers.coupleId, coupleId));
  return row.value;
}

async function findCoupleIdForUser(exec: DbExecutor, userId: string): Promise<string | null> {
  const [row] = await exec
    .select({ coupleId: coupleMembers.coupleId })
    .from(coupleMembers)
    .where(eq(coupleMembers.userId, userId))
    .limit(1);
  return row?.coupleId ?? null;
}

async function findProblem(
  exec: DbExecutor,
  invite: Invite | null,
  userId: string,
  now: Date,
): Promise<InviteProblem | null> {
  if (!invite || invite.revokedAt) return "not_found";
  if (invite.createdBy === userId) return "own_invite";
  if (invite.usedAt) return "used";
  if (invite.expiresAt <= now) return "expired";
  if (await findCoupleIdForUser(exec, userId)) return "already_paired";
  if ((await countMembers(exec, invite.coupleId)) >= 2) return "couple_full";
  return null;
}

export async function getInvitePreview(token: string): Promise<{ inviterName: string } | null> {
  if (!TOKEN_PATTERN.test(token)) return null;
  const row = await loadInvite(db, token);
  if (!row || row.invite.revokedAt) return null;
  return { inviterName: row.inviterName };
}

export async function getInviteView(token: string, userId: string, now: Date = new Date()): Promise<InviteView> {
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "not_found" };
  const row = await loadInvite(db, token);
  const problem = await findProblem(db, row?.invite ?? null, userId, now);
  if (problem || !row) return { ok: false, reason: problem ?? "not_found" };
  return { ok: true, inviterName: row.inviterName };
}

export async function acceptInvite(
  token: string,
  params: { userId: string; name: string; now?: Date },
): Promise<AcceptInviteResult> {
  const name = nameSchema.safeParse(params.name);
  if (!name.success) {
    return { ok: false, reason: "invalid_name", message: name.error.issues[0]?.message ?? "Invalid name" };
  }
  if (!TOKEN_PATTERN.test(token)) return { ok: false, reason: "not_found" };
  const now = params.now ?? new Date();

  try {
    return await db.transaction(async (tx): Promise<AcceptInviteResult> => {
      const initial = await loadInvite(tx, token);
      if (!initial) return { ok: false, reason: "not_found" };

      // Serialize accepts per couple, then re-read so a concurrent accept's used_at is visible.
      await tx.select({ id: couples.id }).from(couples).where(eq(couples.id, initial.invite.coupleId)).for("update");
      const invite = (await loadInvite(tx, token))?.invite ?? null;

      const problem = await findProblem(tx, invite, params.userId, now);
      if (problem || !invite) return { ok: false, reason: problem ?? "not_found" };

      await tx.insert(coupleMembers).values({ coupleId: invite.coupleId, userId: params.userId });
      await tx.update(coupleInvites).set({ usedAt: now }).where(eq(coupleInvites.id, invite.id));
      await tx.update(user).set({ name: name.data }).where(eq(user.id, params.userId));
      return { ok: true, coupleId: invite.coupleId };
    });
  } catch (err) {
    if (isUniqueViolation(err)) return { ok: false, reason: "already_paired" };
    throw err;
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run tests/unit/invites-accept.test.ts`
Expected: PASS (15 tests). If a concurrency test is flaky, the lock or re-read is wrong — do not add retries or sleeps.

- [ ] **Step 5: Run the whole suite and typecheck**

Run: `npm test && npx tsc --noEmit`
Expected: all pass.

- [ ] **Step 6: Commit**

```bash
git add src/lib/invites.ts tests/unit/invites-accept.test.ts
git commit -m "feat: inspect and accept invites with race-safe joins"
```

---

### Task 7: Auth wiring — Better Auth, email, session guards, proxy

**Files:**
- Create: `src/lib/email.ts`, `src/lib/redirects.ts`, `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/lib/session.ts`, `src/app/api/auth/[...all]/route.ts`, `src/proxy.ts`
- Test: `tests/unit/email.test.ts`, `tests/unit/redirects.test.ts`

**Interfaces:**
- Consumes: `db`, schema auth tables, `appUrl`, `getCoupleForUser`, `CoupleWithMembers`
- Produces:
  - `sendMagicLinkEmail(params: { to: string; url: string }): Promise<void>` from `@/lib/email`
  - `safeCallbackPath(value: unknown, fallback?: string): string` from `@/lib/redirects` — only same-site relative paths survive
  - `auth` (Better Auth instance), `googleEnabled: boolean` from `@/lib/auth`
  - `authClient` from `@/lib/auth-client` (client-side: `signIn.magicLink`, `signIn.social`, `signOut`)
  - From `@/lib/session` (server only): `getSession()`, `requireUser(): Promise<SessionUser>`, `requireCouple(): Promise<{ user: SessionUser; couple: CoupleWithMembers }>`, `type SessionUser`
  - HTTP: `/api/auth/*` handled by Better Auth; `/home` and `/onboarding` redirect to `/sign-in` when there is no session cookie

- [ ] **Step 1: Write the failing tests**

`tests/unit/redirects.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/lib/redirects";

describe("safeCallbackPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeCallbackPath("/invite/abc_123")).toBe("/invite/abc_123");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/");
    expect(safeCallbackPath("//evil.example")).toBe("/");
    expect(safeCallbackPath("/\\evil.example")).toBe("/");
  });

  it("falls back for missing or non-string values", () => {
    expect(safeCallbackPath(undefined)).toBe("/");
    expect(safeCallbackPath(["/a", "/b"], "/home")).toBe("/home");
  });
});
```

`tests/unit/email.test.ts`:

```ts
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@/lib/email";

describe("sendMagicLinkEmail", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "duo-mail-"));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("writes the link to .e2e-mail/<email>.txt when EMAIL_TRANSPORT=file", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "");
    const url = "http://localhost:3000/api/auth/magic-link/verify?token=abc";

    await sendMagicLinkEmail({ to: "sarah@duo.test", url });

    expect(await readFile(path.join(dir, ".e2e-mail", "sarah@duo.test.txt"), "utf8")).toBe(url);
  });

  it("never uses the file transport in production", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendMagicLinkEmail({ to: "a@duo.test", url: "http://x" })).rejects.toThrow(
      "RESEND_API_KEY and EMAIL_FROM must be set",
    );
  });
});
```

- [ ] **Step 2: Run the tests to confirm they fail**

Run: `npx vitest run tests/unit/redirects.test.ts tests/unit/email.test.ts`
Expected: FAIL, cannot resolve `@/lib/redirects` and `@/lib/email`.

- [ ] **Step 3: Implement** — `src/lib/redirects.ts`

```ts
export function safeCallbackPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
```

`src/lib/email.ts`:

```ts
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }): Promise<void> {
  if (process.env.EMAIL_TRANSPORT === "file" && process.env.VERCEL_ENV !== "production") {
    const dir = path.join(process.cwd(), ".e2e-mail");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${to.replace(/[^a-zA-Z0-9@._+-]/g, "_")}.txt`), url, "utf8");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: "Your Duo sign-in link 💌",
    text: `Tap to sign in to Duo:\n\n${url}\n\nThis link expires in 15 minutes.`,
    html: magicLinkHtml(url),
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
  }
}

function magicLinkHtml(url: string): string {
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#FBF8F3;padding:32px;color:#1F1B16">
  <p style="font-size:28px;font-weight:700;margin:0 0 16px">duo</p>
  <p style="font-size:16px;margin:0 0 24px">Tap the button to sign in. The link expires in 15 minutes.</p>
  <a href="${href}" style="display:inline-block;background:#1F1B16;color:#FBF8F3;padding:14px 22px;border-radius:16px;text-decoration:none;font-weight:600">Sign in to Duo</a>
  <p style="font-size:13px;color:#6B6258;margin:24px 0 0">If you didn't ask for this, you can ignore this email.</p>
</div>`;
}
```

- [ ] **Step 4: Run the tests to confirm they pass**

Run: `npx vitest run tests/unit/redirects.test.ts tests/unit/email.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Configure Better Auth** — `src/lib/auth.ts`

`nextCookies()` must be the last plugin so Server Actions can set cookies.

```ts
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { magicLink } from "better-auth/plugins/magic-link";
import { db } from "@/db";
import { account, session, user, verification } from "@/db/schema";
import { appUrl } from "@/lib/app-url";
import { sendMagicLinkEmail } from "@/lib/email";

const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

export const googleEnabled = Boolean(googleClientId && googleClientSecret);

export const auth = betterAuth({
  baseURL: appUrl(),
  trustedOrigins: process.env.VERCEL_BRANCH_URL ? [`https://${process.env.VERCEL_BRANCH_URL}`] : [],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { user, session, account, verification },
  }),
  socialProviders:
    googleClientId && googleClientSecret
      ? { google: { clientId: googleClientId, clientSecret: googleClientSecret } }
      : {},
  plugins: [
    magicLink({
      expiresIn: 60 * 15,
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail({ to: email, url });
      },
    }),
    nextCookies(),
  ],
});
```

`src/app/api/auth/[...all]/route.ts`:

```ts
import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
```

`src/lib/auth-client.ts`:

```ts
import { magicLinkClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
```

- [ ] **Step 6: Add server session guards** — `src/lib/session.ts`

```ts
import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { auth } from "@/lib/auth";
import { getCoupleForUser, type CoupleWithMembers } from "@/lib/couples";

export type SessionUser = typeof auth.$Infer.Session.user;

export const getSession = cache(async () => auth.api.getSession({ headers: await headers() }));

export async function requireUser(): Promise<SessionUser> {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  return session.user;
}

export async function requireCouple(): Promise<{ user: SessionUser; couple: CoupleWithMembers }> {
  const user = await requireUser();
  const couple = await getCoupleForUser(user.id);
  if (!couple) redirect("/onboarding");
  return { user, couple };
}
```

- [ ] **Step 7: Add the proxy** — `src/proxy.ts`

```ts
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

// Optimistic only: real checks happen in requireUser/requireCouple.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/home", "/onboarding"],
};
```

- [ ] **Step 8: Verify against the running dev server**

```bash
npm run dev &           # wait for "Ready"
curl -s http://localhost:3000/api/auth/ok
curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/home
curl -s -X POST http://localhost:3000/api/auth/sign-in/magic-link \
  -H "content-type: application/json" -H "origin: http://localhost:3000" \
  -d '{"email":"smoke@duo.test","callbackURL":"/"}'
cat .e2e-mail/smoke@duo.test.txt
kill %1
```

Expected, in order: `{"ok":true}`; `307 http://localhost:3000/sign-in`; `{"status":true}`; a URL containing `/api/auth/magic-link/verify?token=`.

- [ ] **Step 9: Full check and commit**

Run: `npm test && npx tsc --noEmit && npm run lint`
Expected: all pass.

```bash
rm -rf .e2e-mail
git add src/lib/email.ts src/lib/redirects.ts src/lib/auth.ts src/lib/auth-client.ts src/lib/session.ts src/app/api src/proxy.ts tests/unit/email.test.ts tests/unit/redirects.test.ts
git commit -m "feat: wire Better Auth with magic links, Google and session guards"
```

---

### Task 8: Design system, root routing and sign-in pages

**Files:**
- Create: `src/components/ui/button.tsx`, `input.tsx`, `label.tsx` (via shadcn), `src/lib/timezone.ts`, `src/components/timezone-cookie.tsx`, `src/components/sign-in-form.tsx`, `src/app/(auth)/sign-in/page.tsx`, `src/app/(auth)/check-email/page.tsx`, `src/app/manifest.ts`, `src/app/error.tsx`, `src/app/not-found.tsx`, `public/icon.svg`
- Modify: `src/app/layout.tsx`, `src/app/globals.css`, `src/app/page.tsx`
- Delete: default `create-next-app` assets in `public/` (`file.svg`, `globe.svg`, `next.svg`, `vercel.svg`, `window.svg`)

**Interfaces:**
- Consumes: `authClient`, `googleEnabled`, `getSession`, `getCoupleForUser`, `safeCallbackPath`
- Produces:
  - `TZ_COOKIE = "tz"` and `getViewerTimeZone(): Promise<string>` from `@/lib/timezone`
  - `<SignInForm callbackURL: string; googleEnabled: boolean; linkError?: boolean />` from `@/components/sign-in-form` — reused by the invite page in Task 11
  - Tailwind utilities: `bg-peach`, `bg-lilac`, `bg-mint`, `bg-butter`, `font-display`, `font-sans`
  - `Button`, `buttonVariants`, `Input`, `Label` from `@/components/ui/*`
  - Routes: `/` (redirects by state), `/sign-in`, `/check-email`

- [ ] **Step 1: Initialise shadcn/ui and add components**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label
```

Expected: `components.json`, `src/lib/utils.ts`, `src/components/ui/{button,input,label}.tsx` exist, and `src/app/globals.css` has `:root`, `.dark` and `@theme inline` blocks. Confirm `button.tsx` exports `buttonVariants`; if it does not, add `buttonVariants` to its export list.

- [ ] **Step 2: Apply Duo's tokens** — edit `src/app/globals.css`

1. Replace the entire `:root { ... }` block with:

```css
:root {
  --radius: 1.25rem;
  --background: #fbf8f3;
  --foreground: #1f1b16;
  --card: #ffffff;
  --card-foreground: #1f1b16;
  --popover: #ffffff;
  --popover-foreground: #1f1b16;
  --primary: #1f1b16;
  --primary-foreground: #fbf8f3;
  --secondary: #f3eee6;
  --secondary-foreground: #1f1b16;
  --muted: #f3eee6;
  --muted-foreground: #6b6258;
  --accent: #ffd8c2;
  --accent-foreground: #1f1b16;
  --destructive: #d9534f;
  --border: #ece5da;
  --input: #ece5da;
  --ring: #f4a988;
  --peach: #ffd8c2;
  --lilac: #e3daff;
  --mint: #cff0de;
  --butter: #fff1b8;
}
```

2. Delete the entire `.dark { ... }` block (light mode only).
3. Inside `@theme inline { ... }`, remove any existing `--font-sans` / `--font-mono` lines and add:

```css
  --font-sans: var(--font-inter);
  --font-display: var(--font-bricolage);
  --color-peach: var(--peach);
  --color-lilac: var(--lilac);
  --color-mint: var(--mint);
  --color-butter: var(--butter);
```

- [ ] **Step 3: Time zone helpers**

`src/lib/timezone.ts`:

```ts
import "server-only";
import { cookies } from "next/headers";

export const TZ_COOKIE = "tz";

export async function getViewerTimeZone(): Promise<string> {
  return (await cookies()).get(TZ_COOKIE)?.value ?? "UTC";
}
```

`src/components/timezone-cookie.tsx` (the cookie name is repeated here because `@/lib/timezone` is server-only):

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export function TimezoneCookie() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const current = document.cookie
      .split("; ")
      .find((part) => part.startsWith("tz="))
      ?.slice(3);
    if (current && decodeURIComponent(current) === timeZone) return;
    document.cookie = `tz=${encodeURIComponent(timeZone)}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }, [router]);

  return null;
}
```

- [ ] **Step 4: Root layout** — replace `src/app/layout.tsx`

```tsx
import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { TimezoneCookie } from "@/components/timezone-cookie";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const bricolage = Bricolage_Grotesque({ subsets: ["latin"], variable: "--font-bricolage" });

export const metadata: Metadata = {
  title: "Duo",
  description: "A little world for the two of you.",
  appleWebApp: { capable: true, title: "Duo", statusBarStyle: "default" },
};

export const viewport: Viewport = {
  themeColor: "#FBF8F3",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${bricolage.variable}`}>
      <body className="min-h-dvh bg-background font-sans text-foreground antialiased">
        <TimezoneCookie />
        <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-5 py-8">{children}</main>
      </body>
    </html>
  );
}
```

- [ ] **Step 5: PWA manifest, icon, error and not-found pages**

`public/icon.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" rx="112" fill="#FBF8F3"/>
  <circle cx="206" cy="256" r="110" fill="#FFD8C2"/>
  <circle cx="306" cy="256" r="110" fill="#E3DAFF" fill-opacity="0.85"/>
</svg>
```

`src/app/manifest.ts`:

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Duo",
    short_name: "Duo",
    description: "A little world for the two of you.",
    start_url: "/",
    display: "standalone",
    background_color: "#FBF8F3",
    theme_color: "#FBF8F3",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
```

`src/app/error.tsx`:

```tsx
"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🫠
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">Oops, something went wobbly</h1>
      <p className="text-lg text-muted-foreground">It is not you, it is us. Give it another try.</p>
      <Button size="lg" className="h-12 rounded-2xl text-base" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
```

`src/app/not-found.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🧭
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">This page wandered off</h1>
      <p className="text-lg text-muted-foreground">We could not find what you were looking for.</p>
      <Link href="/" className={buttonVariants({ size: "lg", className: "h-12 rounded-2xl text-base" })}>
        Take me home
      </Link>
    </div>
  );
}
```

Delete the default assets: `rm public/file.svg public/globe.svg public/next.svg public/vercel.svg public/window.svg`

- [ ] **Step 6: Root routing** — replace `src/app/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { getCoupleForUser } from "@/lib/couples";
import { getSession } from "@/lib/session";

export default async function RootPage() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const couple = await getCoupleForUser(session.user.id);
  redirect(couple ? "/home" : "/onboarding");
}
```

- [ ] **Step 7: Sign-in form** — `src/components/sign-in-form.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

type Props = { callbackURL: string; googleEnabled: boolean; linkError?: boolean };

export function SignInForm({ callbackURL, googleEnabled, linkError = false }: Props) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState<"email" | "google" | null>(null);
  const [error, setError] = useState<string | null>(
    linkError ? "That link expired or was already used. Get a new one below." : null,
  );

  async function sendLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending("email");
    const { error: sendError } = await authClient.signIn.magicLink({
      email,
      callbackURL,
      errorCallbackURL: "/sign-in?error=link",
    });
    setPending(null);
    if (sendError) {
      setError("We couldn't send the email, try again");
      return;
    }
    router.push(`/check-email?email=${encodeURIComponent(email)}`);
  }

  async function continueWithGoogle() {
    setError(null);
    setPending("google");
    const { error: googleError } = await authClient.signIn.social({ provider: "google", callbackURL });
    if (googleError) {
      setPending(null);
      setError("Google sign-in didn't work, try again");
    }
  }

  return (
    <div className="space-y-6">
      {googleEnabled && (
        <>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="h-12 w-full rounded-2xl bg-card text-base"
            disabled={pending !== null}
            onClick={continueWithGoogle}
          >
            {pending === "google" ? "Opening Google…" : "Continue with Google"}
          </Button>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span className="h-px flex-1 bg-border" />
            or
            <span className="h-px flex-1 bg-border" />
          </div>
        </>
      )}

      <form onSubmit={sendLink} className="space-y-3">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending !== null}>
          {pending === "email" ? "Sending…" : "Email me a link"}
        </Button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
```

- [ ] **Step 8: Sign-in and check-email pages**

`src/app/(auth)/sign-in/page.tsx`:

```tsx
import { redirect } from "next/navigation";
import { SignInForm } from "@/components/sign-in-form";
import { googleEnabled } from "@/lib/auth";
import { safeCallbackPath } from "@/lib/redirects";
import { getSession } from "@/lib/session";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const callbackURL = safeCallbackPath(params.callbackURL, "/");
  if (await getSession()) redirect(callbackURL);

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="font-display text-7xl font-bold tracking-tight">duo</p>
        <p className="text-lg text-muted-foreground">A little world for the two of you.</p>
      </header>
      <SignInForm callbackURL={callbackURL} googleEnabled={googleEnabled} linkError={params.error !== undefined} />
    </div>
  );
}
```

`src/app/(auth)/check-email/page.tsx`:

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";

export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        💌
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">Check your inbox</h1>
      <p className="text-lg text-muted-foreground">
        We sent a sign-in link
        {email ? (
          <>
            {" "}
            to <span className="font-medium text-foreground">{email}</span>
          </>
        ) : null}
        . It expires in 15 minutes.
      </p>
      <Link href="/sign-in" className={buttonVariants({ variant: "ghost" })}>
        Use a different email
      </Link>
    </div>
  );
}
```

- [ ] **Step 9: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: all pass; the route table lists `/`, `/sign-in`, `/check-email`, `/api/auth/[...all]`, `/manifest.webmanifest`.

Then with `npm run dev`:
- `curl -s -o /dev/null -w "%{http_code} %{redirect_url}\n" http://localhost:3000/` → `307 http://localhost:3000/sign-in`
- Open `http://localhost:3000/sign-in` at a 400px-wide viewport (use a browser tool if available; otherwise ask the project owner to look). Check: off-white background, large "duo" wordmark in Bricolage Grotesque, rounded input and button, no horizontal scroll. Submit an email → lands on "Check your inbox", and `.e2e-mail/<email>.txt` exists.

- [ ] **Step 10: Commit**

```bash
rm -rf .e2e-mail
git add -A
git status --short   # confirm no env files or .e2e-mail are staged
git commit -m "feat: add Duo visual system and sign-in flow"
```

---

### Task 9: Onboarding — create the couple

**Files:**
- Create: `src/app/onboarding/actions.ts`, `src/components/onboarding-form.tsx`, `src/app/onboarding/page.tsx`

**Interfaces:**
- Consumes: `requireUser`, `createCouple`, `getCoupleForUser`, `getViewerTimeZone`, `todayInTimeZone`, `Button`, `Input`, `Label`
- Produces:
  - `type OnboardingState = { fieldErrors?: { name?: string; togetherSince?: string }; values?: { name: string; togetherSince: string } }`
  - `createCoupleAction(prev: OnboardingState, formData: FormData): Promise<OnboardingState>` — redirects to `/home` on success
  - Route `/onboarding`, with form labels "What should we call you?" and "When did you two get together?" and the button "Create our little world" (the e2e test in Task 12 uses these exact strings)

- [ ] **Step 1: Server action** — `src/app/onboarding/actions.ts`

```ts
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
```

- [ ] **Step 2: Form** — `src/components/onboarding-form.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { createCoupleAction, type OnboardingState } from "@/app/onboarding/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function OnboardingForm({ defaultName, maxDate }: { defaultName: string; maxDate: string }) {
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(createCoupleAction, {});

  return (
    <form action={formAction} className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">What should we call you?</Label>
        <Input
          id="name"
          name="name"
          required
          maxLength={40}
          autoComplete="given-name"
          defaultValue={state.values?.name ?? defaultName}
          aria-invalid={Boolean(state.fieldErrors?.name)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.name && <p className="text-sm text-destructive">{state.fieldErrors.name}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="togetherSince">When did you two get together?</Label>
        <Input
          id="togetherSince"
          name="togetherSince"
          type="date"
          required
          max={maxDate}
          defaultValue={state.values?.togetherSince}
          aria-invalid={Boolean(state.fieldErrors?.togetherSince)}
          className="h-12 rounded-2xl bg-card text-base"
        />
        {state.fieldErrors?.togetherSince && (
          <p className="text-sm text-destructive">{state.fieldErrors.togetherSince}</p>
        )}
      </div>

      <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
        {pending ? "Creating…" : "Create our little world"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 3: Page** — `src/app/onboarding/page.tsx`

```tsx
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";
import { getCoupleForUser } from "@/lib/couples";
import { todayInTimeZone } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export default async function OnboardingPage() {
  const user = await requireUser();
  if (await getCoupleForUser(user.id)) redirect("/home");
  const maxDate = todayInTimeZone(await getViewerTimeZone());

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="text-5xl" aria-hidden>
          🏡
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">{"Let's build your little world"}</h1>
        <p className="text-lg text-muted-foreground">Two quick things, then you can invite your person.</p>
      </header>
      <OnboardingForm defaultName={user.name} maxDate={maxDate} />
    </div>
  );
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit && npm run lint`
Expected: pass.

Manual check with `npm run dev`: sign in via the link in `.e2e-mail/<email>.txt` → you land on `/onboarding`. Submit with a blank name (after removing the `required` attribute in devtools) → "Tell us what to call you" appears and the date you typed stays. Submit valid values → redirected to `/home`, which returns 404 until Task 10. Then `/onboarding` redirects to `/home`.

- [ ] **Step 5: Commit**

```bash
rm -rf .e2e-mail
git add src/app/onboarding src/components/onboarding-form.tsx
git commit -m "feat: onboarding creates the couple"
```

---

### Task 10: Home — waiting state and couple hero

**Files:**
- Create: `src/app/(app)/home/actions.ts`, `src/app/(app)/home/page.tsx`, `src/components/sign-out-button.tsx`, `src/components/waiting-for-partner.tsx`, `src/components/couple-hero.tsx`

**Interfaces:**
- Consumes: `requireCouple`, `getActiveInvite`, `createInvite`, `inviteUrl`, `daysTogether`, `getViewerTimeZone`, `authClient`, `db`
- Produces:
  - `regenerateInviteAction(): Promise<void>`
  - Route `/home` with these strings the e2e test relies on: heading "Waiting for your person", invite input `data-testid="invite-url"`, names heading `data-testid="couple-names"`, text "together for"

- [ ] **Step 1: Server action** — `src/app/(app)/home/actions.ts`

```ts
"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { createInvite } from "@/lib/invites";
import { requireCouple } from "@/lib/session";

export async function regenerateInviteAction(): Promise<void> {
  const { user, couple } = await requireCouple();
  if (couple.members.length >= 2) return;
  await createInvite(db, { coupleId: couple.id, createdBy: user.id });
  revalidatePath("/home");
}
```

- [ ] **Step 2: Sign-out button** — `src/components/sign-out-button.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await authClient.signOut();
    router.push("/sign-in");
    router.refresh();
  }

  return (
    <Button variant="ghost" size="sm" onClick={signOut}>
      Sign out
    </Button>
  );
}
```

- [ ] **Step 3: Waiting state** — `src/components/waiting-for-partner.tsx`

```tsx
"use client";

import { useState } from "react";
import { regenerateInviteAction } from "@/app/(app)/home/actions";
import { SignOutButton } from "@/components/sign-out-button";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function WaitingForPartner({ inviteUrl }: { inviteUrl: string | null }) {
  const [copied, setCopied] = useState(false);

  async function share() {
    if (!inviteUrl) return;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Join me on Duo", text: "Come be my duo 💕", url: inviteUrl });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <SignOutButton />
      </div>

      <section className="space-y-6 rounded-3xl bg-lilac/60 p-8">
        <p className="text-5xl" aria-hidden>
          💌
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">Waiting for your person</h1>
        <p className="text-lg text-foreground/80">
          Send them this link. When they join, your little world opens up.
        </p>

        {inviteUrl ? (
          <div className="space-y-3">
            <Input
              readOnly
              value={inviteUrl}
              data-testid="invite-url"
              aria-label="Invite link"
              className="h-12 rounded-2xl bg-card text-sm"
              onFocus={(event) => event.currentTarget.select()}
            />
            <Button size="lg" className="h-12 w-full rounded-2xl text-base" onClick={share}>
              {copied ? "Copied!" : "Share invite link"}
            </Button>
          </div>
        ) : (
          <p className="text-sm text-foreground/70">Your last link expired.</p>
        )}

        <form action={regenerateInviteAction}>
          <Button type="submit" variant="ghost" className="w-full">
            Make a new link
          </Button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 4: Couple hero** — `src/components/couple-hero.tsx`

```tsx
import { SignOutButton } from "@/components/sign-out-button";

type Props = { firstName: string; secondName: string; days: number };

export function CoupleHero({ firstName, secondName, days }: Props) {
  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="flex justify-end">
        <SignOutButton />
      </div>

      <section className="rounded-3xl bg-peach/60 p-8">
        <h1 data-testid="couple-names" className="font-display text-4xl font-bold tracking-tight">
          {firstName} <span aria-hidden>❤️</span> {secondName}
        </h1>
        <p className="mt-6 text-lg text-foreground/80">
          {days === 0 ? (
            "your first day together ✨"
          ) : (
            <>
              together for{" "}
              <span className="font-display text-6xl font-bold text-foreground">{days.toLocaleString("en")}</span>{" "}
              {days === 1 ? "day" : "days"}
            </>
          )}
        </p>
      </section>
    </div>
  );
}
```

- [ ] **Step 5: Page** — `src/app/(app)/home/page.tsx`

```tsx
import { CoupleHero } from "@/components/couple-hero";
import { WaitingForPartner } from "@/components/waiting-for-partner";
import { daysTogether } from "@/lib/dates";
import { getActiveInvite, inviteUrl } from "@/lib/invites";
import { requireCouple } from "@/lib/session";
import { getViewerTimeZone } from "@/lib/timezone";

export default async function HomePage() {
  const { couple } = await requireCouple();

  if (couple.members.length < 2) {
    const invite = await getActiveInvite(couple.id);
    return <WaitingForPartner inviteUrl={invite ? inviteUrl(invite.token) : null} />;
  }

  const [first, second] = couple.members;
  const days = daysTogether(couple.togetherSince, await getViewerTimeZone());
  return <CoupleHero firstName={first.name} secondName={second.name} days={days} />;
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: pass; `/home` is in the route table.

Manual check with `npm run dev`, continuing from Task 9's user: `/home` shows "Waiting for your person" with an invite URL of the form `http://localhost:3000/invite/<43 chars>`. "Make a new link" changes the URL. "Sign out" returns to `/sign-in`.

- [ ] **Step 7: Commit**

```bash
rm -rf .e2e-mail
git add "src/app/(app)" src/components/sign-out-button.tsx src/components/waiting-for-partner.tsx src/components/couple-hero.tsx
git commit -m "feat: home screen with invite waiting state and couple hero"
```

---

### Task 11: Invite page — accept or explain why not

**Files:**
- Create: `src/lib/invite-messages.ts`, `src/components/invite-problem.tsx`, `src/app/invite/[token]/actions.ts`, `src/components/accept-invite-form.tsx`, `src/app/invite/[token]/page.tsx`

**Interfaces:**
- Consumes: `getSession`, `requireUser`, `getInvitePreview`, `getInviteView`, `acceptInvite`, `InviteProblem`, `SignInForm`, `googleEnabled`
- Produces:
  - `INVITE_PROBLEM_COPY: Record<InviteProblem, { title: string; body: string; cta: { label: string; href: string } }>`
  - `<InviteProblemView reason: InviteProblem />`
  - `type AcceptInviteState = { reason?: InviteProblem; nameError?: string; name?: string }`
  - `acceptInviteAction(token: string, prev: AcceptInviteState, formData: FormData): Promise<AcceptInviteState>`
  - Route `/invite/[token]` with strings the e2e test relies on: heading "{inviter} invited you to Duo", label "What should we call you?", button "Join {inviter}"

- [ ] **Step 1: Copy for each problem** — `src/lib/invite-messages.ts`

```ts
import type { InviteProblem } from "@/lib/invites";

type Copy = { title: string; body: string; cta: { label: string; href: string } };

export const INVITE_PROBLEM_COPY: Record<InviteProblem, Copy> = {
  not_found: {
    title: "This link doesn't work anymore",
    body: "Ask your partner to send you a fresh one.",
    cta: { label: "Go home", href: "/" },
  },
  expired: {
    title: "This link has expired",
    body: "Invite links last 7 days. Ask your partner for a new one.",
    cta: { label: "Go home", href: "/" },
  },
  used: {
    title: "This link was already used",
    body: "Each invite link works once. If that wasn't you, ask for a new one.",
    cta: { label: "Go home", href: "/" },
  },
  own_invite: {
    title: "This is your own invite",
    body: "Send it to your partner so they can join you.",
    cta: { label: "Back to home", href: "/home" },
  },
  already_paired: {
    title: "You're already paired",
    body: "You're already part of a duo.",
    cta: { label: "Go to your home", href: "/home" },
  },
  couple_full: {
    title: "This duo is already complete",
    body: "This couple already has two people.",
    cta: { label: "Go home", href: "/" },
  },
};
```

- [ ] **Step 2: Problem view** — `src/components/invite-problem.tsx`

```tsx
import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { INVITE_PROBLEM_COPY } from "@/lib/invite-messages";
import type { InviteProblem } from "@/lib/invites";

export function InviteProblemView({ reason }: { reason: InviteProblem }) {
  const copy = INVITE_PROBLEM_COPY[reason];

  return (
    <div className="flex flex-1 flex-col justify-center gap-6">
      <p className="text-6xl" aria-hidden>
        🥺
      </p>
      <h1 className="font-display text-4xl font-bold tracking-tight">{copy.title}</h1>
      <p className="text-lg text-muted-foreground">{copy.body}</p>
      <Link href={copy.cta.href} className={buttonVariants({ size: "lg", className: "h-12 rounded-2xl text-base" })}>
        {copy.cta.label}
      </Link>
    </div>
  );
}
```

- [ ] **Step 3: Server action** — `src/app/invite/[token]/actions.ts`

```ts
"use server";

import { redirect } from "next/navigation";
import { acceptInvite, type InviteProblem } from "@/lib/invites";
import { requireUser } from "@/lib/session";

export type AcceptInviteState = { reason?: InviteProblem; nameError?: string; name?: string };

export async function acceptInviteAction(
  token: string,
  _prev: AcceptInviteState,
  formData: FormData,
): Promise<AcceptInviteState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "");

  const result = await acceptInvite(token, { userId: user.id, name });

  if (result.ok) redirect("/home");
  if (result.reason === "invalid_name") return { nameError: result.message, name };
  return { reason: result.reason };
}
```

- [ ] **Step 4: Accept form** — `src/components/accept-invite-form.tsx`

```tsx
"use client";

import { useActionState } from "react";
import { acceptInviteAction, type AcceptInviteState } from "@/app/invite/[token]/actions";
import { InviteProblemView } from "@/components/invite-problem";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = { token: string; inviterName: string; defaultName: string };

export function AcceptInviteForm({ token, inviterName, defaultName }: Props) {
  const [state, formAction, pending] = useActionState<AcceptInviteState, FormData>(
    acceptInviteAction.bind(null, token),
    {},
  );

  if (state.reason) return <InviteProblemView reason={state.reason} />;

  return (
    <div className="flex flex-1 flex-col justify-center gap-10">
      <header className="space-y-3">
        <p className="text-6xl" aria-hidden>
          💕
        </p>
        <h1 className="font-display text-4xl font-bold tracking-tight">{inviterName} invited you to Duo</h1>
        <p className="text-lg text-muted-foreground">Join to start your little world together.</p>
      </header>

      <form action={formAction} className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="name">What should we call you?</Label>
          <Input
            id="name"
            name="name"
            required
            maxLength={40}
            autoComplete="given-name"
            defaultValue={state.name ?? defaultName}
            aria-invalid={Boolean(state.nameError)}
            className="h-12 rounded-2xl bg-card text-base"
          />
          {state.nameError && <p className="text-sm text-destructive">{state.nameError}</p>}
        </div>
        <Button type="submit" size="lg" className="h-12 w-full rounded-2xl text-base" disabled={pending}>
          {pending ? "Joining…" : `Join ${inviterName}`}
        </Button>
      </form>
    </div>
  );
}
```

- [ ] **Step 5: Page** — `src/app/invite/[token]/page.tsx`

```tsx
import { AcceptInviteForm } from "@/components/accept-invite-form";
import { InviteProblemView } from "@/components/invite-problem";
import { SignInForm } from "@/components/sign-in-form";
import { googleEnabled } from "@/lib/auth";
import { getInvitePreview, getInviteView } from "@/lib/invites";
import { getSession } from "@/lib/session";

export default async function InvitePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const session = await getSession();

  if (!session) {
    const preview = await getInvitePreview(token);
    if (!preview) return <InviteProblemView reason="not_found" />;

    return (
      <div className="flex flex-1 flex-col justify-center gap-10">
        <header className="space-y-3">
          <p className="text-6xl" aria-hidden>
            💕
          </p>
          <h1 className="font-display text-4xl font-bold tracking-tight">
            {preview.inviterName} invited you to Duo
          </h1>
          <p className="text-lg text-muted-foreground">Sign in to join them.</p>
        </header>
        <SignInForm callbackURL={`/invite/${token}`} googleEnabled={googleEnabled} />
      </div>
    );
  }

  const view = await getInviteView(token, session.user.id);
  if (!view.ok) return <InviteProblemView reason={view.reason} />;

  return <AcceptInviteForm token={token} inviterName={view.inviterName} defaultName={session.user.name} />;
}
```

- [ ] **Step 6: Verify**

Run: `npx tsc --noEmit && npm run lint && npm run build`
Expected: pass; `/invite/[token]` is in the route table.

Manual check with `npm run dev`:
- `http://localhost:3000/invite/nope` → "This link doesn't work anymore".
- Signed in as the inviter from Task 10, open your own invite URL → "This is your own invite".

- [ ] **Step 7: Commit**

```bash
rm -rf .e2e-mail
git add src/lib/invite-messages.ts src/components/invite-problem.tsx src/components/accept-invite-form.tsx src/app/invite
git commit -m "feat: invite page to accept or explain invite problems"
```

---

### Task 12: End-to-end pairing test

**Files:**
- Create: `playwright.config.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/pairing.spec.ts`

**Interfaces:**
- Consumes: every route and UI string listed in Tasks 8–11; `runMigrations`; `RESET_SQL`; `EMAIL_TRANSPORT=file`
- Produces: `npm run test:e2e` covering the full two-person flow

- [ ] **Step 1: Install the browser**

Run: `npx playwright install chromium`

- [ ] **Step 2: Config** — `playwright.config.ts`

```ts
import { defineConfig, devices } from "@playwright/test";
import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.test.local", quiet: true });

const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "tests/e2e",
  workers: 1,
  timeout: 60_000,
  globalSetup: "./tests/e2e/global-setup.ts",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [{ name: "mobile-chrome", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npm run dev -- --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
      BETTER_AUTH_URL: baseURL,
      BETTER_AUTH_SECRET: "e2e-only-secret-not-used-anywhere-else-123",
      EMAIL_TRANSPORT: "file",
      GOOGLE_CLIENT_ID: "",
      GOOGLE_CLIENT_SECRET: "",
    },
  },
});
```

- [ ] **Step 3: Global setup** — `tests/e2e/global-setup.ts`

```ts
import { rm } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";
import { runMigrations } from "../../src/db/run-migrations";
import { RESET_SQL } from "../helpers/reset-sql";

export default async function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test.local");

  await runMigrations(url);
  const pool = new Pool({ connectionString: url });
  try {
    await pool.query(RESET_SQL);
  } finally {
    await pool.end();
  }
  await rm(".e2e-mail", { recursive: true, force: true });
}
```

- [ ] **Step 4: Write the test** — `tests/e2e/pairing.spec.ts`

```ts
import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function readMagicLink(email: string): Promise<string> {
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

async function signInWithEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await readMagicLink(email));
}

test("two people sign up, pair with an invite link and share a home", async ({ browser }) => {
  const stamp = Date.now();
  const jaffranEmail = `jaffran-${stamp}@duo.test`;
  const sarahEmail = `sarah-${stamp}@duo.test`;

  const jaffran = await (await browser.newContext()).newPage();
  const sarah = await (await browser.newContext()).newPage();

  // Jaffran signs up and creates the couple
  await jaffran.goto("/");
  await expect(jaffran).toHaveURL(/\/sign-in$/);
  await signInWithEmail(jaffran, jaffranEmail);
  await expect(jaffran).toHaveURL(/\/onboarding$/);
  await jaffran.getByLabel("What should we call you?").fill("Jaffran");
  await jaffran.getByLabel("When did you two get together?").fill("2024-05-10");
  await jaffran.getByRole("button", { name: "Create our little world" }).click();
  await expect(jaffran.getByRole("heading", { name: "Waiting for your person" })).toBeVisible();
  const inviteLink = await jaffran.getByTestId("invite-url").inputValue();
  expect(inviteLink).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

  // Jaffran cannot accept their own invite
  await jaffran.goto(inviteLink);
  await expect(jaffran.getByRole("heading", { name: "This is your own invite" })).toBeVisible();

  // Sarah opens the link, signs in and joins
  await sarah.goto(inviteLink);
  await expect(sarah.getByRole("heading", { name: "Jaffran invited you to Duo" })).toBeVisible();
  await signInWithEmail(sarah, sarahEmail);
  await expect(sarah).toHaveURL(/\/invite\//);
  await sarah.getByLabel("What should we call you?").fill("Sarah");
  await sarah.getByRole("button", { name: "Join Jaffran" }).click();

  // Both see the shared home
  await expect(sarah).toHaveURL(/\/home$/);
  await expect(sarah.getByTestId("couple-names")).toHaveText(/Jaffran.*Sarah/);
  await expect(sarah.getByText(/together for/)).toBeVisible();

  await jaffran.goto("/home");
  await expect(jaffran.getByTestId("couple-names")).toHaveText(/Jaffran.*Sarah/);

  // The link is now spent
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto("/sign-in");
  await signInWithEmail(stranger, `stranger-${stamp}@duo.test`);
  await stranger.goto(inviteLink);
  await expect(stranger.getByRole("heading", { name: "This link was already used" })).toBeVisible();
});
```

- [ ] **Step 5: Run it**

Stop any other `next dev` process in this folder first.

Run: `npm run test:e2e`
Expected: 1 passed. If it fails, open `npx playwright show-trace test-results/**/trace.zip` and fix the app, not the test, unless the test contradicts the spec.

- [ ] **Step 6: Commit**

```bash
git add playwright.config.ts tests/e2e
git commit -m "test: end-to-end sign up, invite and pairing flow"
```

---

### Task 13: Deploy to Vercel with Neon, Google and Resend

Most steps need the project owner's accounts. The executor prepares commands and checks results; the owner clicks through dashboards.

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: `vercel.json` build command, `.env.example`
- Produces: a production URL where the Task 12 flow works with real email and Google sign-in

- [ ] **Step 1: Replace `README.md`**

````markdown
# Duo

A little world for the two of you. Next.js 16 · Neon · Better Auth · Vercel.

## Local setup

1. `npm install`
2. Create a Neon project with a `main` branch (dev) and a `test` branch.
3. Copy `.env.example` into `.env.local` (dev values) and `.env.test.local` (`TEST_DATABASE_URL` only).
4. `npm run db:migrate`
5. `npm run dev` — with `EMAIL_TRANSPORT=file`, magic links are written to `.e2e-mail/<email>.txt`.

## Tests

- `npm test` — unit and integration tests against the Neon test branch (it gets truncated).
- `npm run test:e2e` — Playwright, full pairing flow.

## Deploy

Vercel runs `npm run db:migrate && npm run build` (see `vercel.json`). Env vars are listed in `.env.example`.
````

Commit: `git add README.md && git commit -m "docs: local setup, tests and deploy notes"`

- [ ] **Step 2: Push to GitHub** (owner confirms repo name and visibility first)

```bash
gh repo create duo --private --source . --push
```

- [ ] **Step 3: Create the Vercel project** (owner)

1. On vercel.com: Add New → Project → import the `duo` repo. Framework preset: Next.js. Keep the build command from `vercel.json`.
2. In the project, go to Storage → Connect Database → Neon, and link the existing `duo` Neon project. Enable **preview branches**, so each preview deployment gets its own Neon branch and `DATABASE_URL`.

- [ ] **Step 4: Google OAuth client** (owner)

1. Google Cloud Console → APIs & Services → Credentials → Create OAuth client ID → Web application.
2. Authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google`
   - `https://<production-domain>/api/auth/callback/google`
3. Configure the OAuth consent screen (app name "Duo", scopes: email, profile) and publish it.

- [ ] **Step 5: Resend** (owner)

Add and verify the sending domain in Resend, create an API key, and choose `EMAIL_FROM` (for example `Duo <hello@yourdomain.com>`).

- [ ] **Step 6: Vercel environment variables** (owner)

| Variable | Production | Preview | Development |
|----------|-----------|---------|-------------|
| `DATABASE_URL` | set by Neon integration | set per branch by integration | — |
| `BETTER_AUTH_SECRET` | new `openssl rand -base64 32` | a different generated value | — |
| `BETTER_AUTH_URL` | `https://<production-domain>` | **leave unset** (uses `VERCEL_URL`) | — |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | set | **leave unset** | set |
| `RESEND_API_KEY` | set | set | — |
| `EMAIL_FROM` | set | set | — |
| `EMAIL_TRANSPORT` | **unset** | **unset** | — |

Preview deployments are protected by Vercel Authentication by default, so magic links in emails open only for people signed in to Vercel. That's fine for testing.

- [ ] **Step 7: Deploy and check the build log**

Push to `main` (or redeploy). In the build log, confirm `Migrations applied` appears before `next build`.

- [ ] **Step 8: Production smoke test** (owner, two real accounts on two devices or browsers)

1. Person A: open the production URL → Continue with Google → onboarding → share the invite link.
2. Person B: open the link → Email me a link → the email arrives from `EMAIL_FROM` → tap it → returns to the invite → join.
3. Both see "A ❤️ B · together for N days". On a phone, Add to Home Screen shows the Duo icon.

If any step fails, check the runtime logs in Vercel before changing code.
