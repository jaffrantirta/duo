import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PLAN_TYPE_SLUGS } from "@/lib/plan-types";

describe("discover cards seed migration", () => {
  it("ships 20 unique, validly-typed curated cards", () => {
    const sql = readFileSync("drizzle/0005_seed_discover_cards.sql", "utf8");
    const rowMatches = [...sql.matchAll(/\('(seed-\d+)', NULL, '([a-z-]+)', /g)];

    expect(rowMatches).toHaveLength(20);

    const ids = rowMatches.map((m) => m[1]);
    expect(new Set(ids).size).toBe(20);

    const types = rowMatches.map((m) => m[2]);
    for (const type of types) {
      expect(PLAN_TYPE_SLUGS).toContain(type);
    }

    expect(sql).toContain("ON CONFLICT (id) DO NOTHING");
  });
});
