import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

export const pool = new Pool({ connectionString });
pool.on("error", (error: Error) => {
  console.error("Postgres pool error", error);
});
export const db = drizzle({ client: pool, schema });

export type Db = typeof db;
// Satisfied by both `db` and a transaction `tx`.
export type DbExecutor = Pick<Db, "select" | "insert" | "update" | "delete">;
