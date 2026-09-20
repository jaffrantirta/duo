// One-off: mirror every app table from OLD_DATABASE_URL into NEW_DATABASE_URL.
// Reads one consistent snapshot, writes in a single transaction, and only commits if every
// table's row count and checksum match — otherwise the target is left untouched.
import { loadEnvConfig } from "@next/env";
import { Pool, type PoolClient } from "pg";
import { runMigrations } from "../src/db/run-migrations";

loadEnvConfig(process.cwd());

// Parents before children so foreign keys hold at every step.
const TABLES = [
  "user",
  "account",
  "session",
  "verification",
  "waitlist",
  "couples",
  "couple_members",
  "couple_invites",
  "plans",
  "discover_cards",
  "discover_swipes",
];

const oldUrl = process.env.OLD_DATABASE_URL;
const newUrl = process.env.NEW_DATABASE_URL;
if (!oldUrl || !newUrl) {
  console.error("Set OLD_DATABASE_URL (current database) and NEW_DATABASE_URL (empty target).");
  process.exit(1);
}
if (oldUrl === newUrl) {
  console.error("OLD_DATABASE_URL and NEW_DATABASE_URL are identical.");
  process.exit(1);
}

const label = (url: string) => {
  const { hostname, pathname } = new URL(url);
  return `${hostname}${pathname}`;
};

async function count(client: PoolClient, table: string): Promise<number> {
  const { rows } = await client.query(`select count(*)::int as n from "${table}"`);
  return rows[0].n;
}

// Ordered with the C collation so two servers with different default collations agree.
async function checksum(client: PoolClient, table: string) {
  const { rows } = await client.query(
    `select count(*)::int as n,
            md5(coalesce(string_agg(r, '|' order by r collate "C"), '')) as sum
       from (select row_to_json(t)::text as r from "${table}" t) x`,
  );
  return { n: rows[0].n as number, sum: rows[0].sum as string };
}

async function main() {
  console.log(`Copying ${label(oldUrl!)} -> ${label(newUrl!)}`);
  await runMigrations(newUrl!);

  const oldPool = new Pool({ connectionString: oldUrl, max: 1 });
  const newPool = new Pool({ connectionString: newUrl, max: 1 });
  const from = await oldPool.connect();
  const to = await newPool.connect();

  try {
    await from.query("begin isolation level repeatable read read only");
    await to.query("begin");
    // JSON renders timestamptz in the session zone; pin both sides so checksums are comparable.
    await from.query("set local time zone 'UTC'");
    await to.query("set local time zone 'UTC'");

    const { rows: oldTables } = await from.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE'",
    );
    const uncovered = oldTables.map((r) => r.table_name as string).filter((name) => !TABLES.includes(name));
    if (uncovered.length > 0) throw new Error(`Tables this script does not copy: ${uncovered.join(", ")}`);

    // The target must be a fresh database. Only discover_cards may hold rows (the seed migration's).
    for (const table of TABLES.filter((t) => t !== "discover_cards")) {
      if ((await count(to, table)) > 0) throw new Error(`Target already has data in "${table}"; refusing to copy over it.`);
    }
    const { rows: custom } = await to.query("select count(*)::int as n from discover_cards where id not like 'seed-%'");
    if (custom[0].n > 0) throw new Error(`Target already has custom rows in "discover_cards"; refusing to copy over it.`);
    await to.query("delete from discover_cards");

    // ponytail: whole table in memory per query. Fine for a couples app; chunk if a table ever reaches millions of rows.
    for (const table of TABLES) {
      const { rows } = await from.query(`select coalesce(json_agg(x), '[]'::json)::text as data from "${table}" x`);
      await to.query(`insert into "${table}" select * from json_populate_recordset(null::"${table}", $1::json)`, [rows[0].data]);
    }

    let allMatch = true;
    for (const table of TABLES) {
      const [a, b] = [await checksum(from, table), await checksum(to, table)];
      const same = a.n === b.n && a.sum === b.sum;
      allMatch &&= same;
      console.log(`${same ? "ok  " : "DIFF"} ${table.padEnd(16)} ${a.n} -> ${b.n}`);
    }
    if (!allMatch) throw new Error("Row counts or checksums differ. Rolled back; the target is unchanged.");

    await to.query("commit");
    console.log("Copied and verified. The target now mirrors the source.");
  } catch (error) {
    await to.query("rollback").catch(() => {});
    throw error;
  } finally {
    await from.query("rollback").catch(() => {});
    from.release();
    to.release();
    await oldPool.end();
    await newPool.end();
  }
}

main().then(
  () => process.exit(0),
  (error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  },
);
