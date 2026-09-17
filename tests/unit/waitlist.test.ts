import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { db } from "@/db";
import { waitlist } from "@/db/schema";
import { joinWaitlist } from "@/lib/waitlist";
import { resetDb } from "../helpers/db";

describe("joinWaitlist", () => {
  beforeEach(resetDb);

  it("stores a trimmed, lowercased email", async () => {
    const result = await joinWaitlist("  Jaffran@Example.com  ");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(waitlist).where(eq(waitlist.email, "jaffran@example.com"));
    expect(rows).toHaveLength(1);
  });

  it("rejects an invalid email", async () => {
    const result = await joinWaitlist("not-an-email");
    expect(result).toEqual({ ok: false, error: "Enter a valid email" });
  });

  it("treats a duplicate as success without creating a second row", async () => {
    await joinWaitlist("sarah@example.com");

    const result = await joinWaitlist("Sarah@Example.com");

    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(waitlist).where(eq(waitlist.email, "sarah@example.com"));
    expect(rows).toHaveLength(1);
  });
});
