# Duo

A little world for the two of you. Next.js 16 · Neon · Better Auth · Vercel.

## Local setup

1. `npm install`
2. Create a Neon project. Use its main database for dev, and a separate database or branch for tests (tests truncate it).
3. Copy `.env.example` into `.env.local` (dev values) and `.env.test.local` (`TEST_DATABASE_URL` only).
4. `npm run db:migrate`
5. `npm run dev` — with `EMAIL_TRANSPORT=file`, magic links are written to `.e2e-mail/<email>.txt`.

## Tests

- `npm test` — unit and integration tests against `TEST_DATABASE_URL` (it gets truncated).
- `npm run test:e2e` — Playwright, full pairing flow. Run `npx playwright install chromium` once before the first e2e run.

## Deploy

Vercel runs `npm run db:migrate && npm run build` (see `vercel.json`). Env vars are listed in `.env.example`.
