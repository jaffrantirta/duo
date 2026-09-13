import { runMigrations } from "../src/db/run-migrations";

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) {
    throw new Error("TEST_DATABASE_URL is not set. Add it to .env.test.local");
  }
  await runMigrations(url);
}
