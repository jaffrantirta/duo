# Move Duo from Neon to a dedicated Postgres

The app now uses the standard `pg` driver, so it talks to Neon or any Postgres with only a
`DATABASE_URL` change. Order matters: **deploy the code first, copy the data second, switch the
env var last.** Switching the env var before the code is deployed takes the app down (the old
Neon-only driver can't talk to a plain Postgres server).

Snapshot of the current Neon DB (2026-09-20): Postgres 18.6, about 8 MB, extensions: plpgsql only,
UTF8, 11 app tables, no sequences to fix up.

## 0. Prepare the new database

- Postgres 16 or newer (18 matches Neon today), UTF8 encoding, an empty database.
- Same region as your Vercel functions (Project > Settings > Functions > Region). Distance to the
  DB is most of your per-query latency.
- Reachable from Vercel. Functions and builds use changing IPs, so allow public connections
  (0.0.0.0/0) protected by a strong password and TLS, or use Vercel static IPs if your plan has them.
- Connection string: `postgresql://USER:PASSWORD@HOST:5432/DBNAME?sslmode=verify-full`.
  If the server uses a self-signed certificate, use `?uselibpqcompat=true&sslmode=require` instead.
  (Any `require` in the URL also prints a harmless `SECURITY WARNING` on startup; `verify-full`
  silences it.)

## 1. Ship the driver swap

Merge the `dedicated-postgres` branch and let Vercel deploy. It runs on your current Neon URL
unchanged. Check that sign-in and `/discover` still work before continuing.

## 2. Copy the data

Pick a quiet moment: anything written to Neon after this step is not carried over. From the repo
root, after `npm install`:

```bash
OLD_DATABASE_URL='<current DATABASE_URL from Vercel>' \
NEW_DATABASE_URL='<new connection string>' \
npm run db:copy
```

It applies the schema to the new DB, copies every table from one consistent snapshot in a single
transaction, and commits only if every table's row count and checksum match. Expected output is
`ok` for all 11 tables, then `Copied and verified.`

- If it fails, it rolls back and the new DB is unchanged. Fix the cause and run it again.
- It refuses to run against a target that already has data. To redo a finished copy, recreate the
  target database first.
- Sessions are copied too, so people stay signed in as long as `BETTER_AUTH_SECRET` is unchanged.

## 3. Switch

Vercel > Project > Settings > Environment Variables: set `DATABASE_URL` to the new string
(Production, and Preview if you use it), then **redeploy**. Env changes only apply to new
deployments. The build's `db:migrate` step is a no-op because the copy already applied every
migration.

## 4. Verify

- Sign in with an existing account.
- `/home`, `/plans` and `/discover` show the same data as before; create a plan and reload.
- Vercel logs show no `Postgres pool error`.

## 5. Roll back if needed

Set `DATABASE_URL` back to the Neon string and redeploy; the code works with both. Data written to
the new DB after the switch is not in Neon. Keep the Neon project for about a week, then delete it.

## Optional: remove test accounts

As of 2026-09-20, 14 of the 16 users in the Neon DB are `@duo.test` accounts left by test runs.
Preview first, then delete on whichever DB you keep:

```sql
select id, email from "user" where email like '%@duo.test';

delete from couples c where not exists (
  select 1 from couple_members m join "user" u on u.id = m.user_id
  where m.couple_id = c.id and u.email not like '%@duo.test'
);
delete from "user" where email like '%@duo.test';
```
