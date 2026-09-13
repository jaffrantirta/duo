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
