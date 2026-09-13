import { sql } from "drizzle-orm";
import { db } from "@/db";
import { coupleMembers, couples, user } from "@/db/schema";
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

export async function createTestCouple(userId: string, togetherSince = "2024-05-10"): Promise<string> {
  const [couple] = await db.insert(couples).values({ togetherSince }).returning({ id: couples.id });
  await db.insert(coupleMembers).values({ coupleId: couple.id, userId });
  return couple.id;
}
