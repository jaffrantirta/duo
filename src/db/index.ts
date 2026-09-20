import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

// ponytail: per-instance cap. Serverless instances multiply this, so if instances x 5 nears the
// server's max_connections, put PgBouncer (or the provider's pooler) in front of the database.
export const pool = new Pool({ connectionString, max: 5 });
pool.on("error", (error: Error) => {
  console.error("Postgres pool error", error);
});
export const db = drizzle({ client: pool, schema });

export type Db = typeof db;
// Satisfied by both `db` and a transaction `tx`.
export type DbExecutor = Pick<Db, "select" | "insert" | "update" | "delete">;
