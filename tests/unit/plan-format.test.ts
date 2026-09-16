import { describe, expect, it } from "vitest";
import { formatPlanDate } from "@/lib/plan-format";

describe("formatPlanDate", () => {
  it("is null without a date", () => {
    expect(formatPlanDate(null, null)).toBeNull();
    expect(formatPlanDate(null, "19:30")).toBeNull();
  });

  it("formats a date on its own", () => {
    expect(formatPlanDate("2026-10-03", null)).toBe("Sat 3 Oct");
  });

  it("appends a 12-hour time", () => {
    expect(formatPlanDate("2026-10-03", "19:30")).toBe("Sat 3 Oct · 7:30 pm");
  });

  it("reads a date as written, regardless of the machine's time zone", () => {
    expect(formatPlanDate("2026-01-01", null)).toBe("Thu 1 Jan");
  });
});
