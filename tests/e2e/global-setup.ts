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
