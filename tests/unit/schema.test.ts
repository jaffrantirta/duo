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
