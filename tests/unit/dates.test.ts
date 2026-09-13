import { describe, expect, it } from "vitest";
import { daysTogether, todayInTimeZone } from "@/lib/dates";

const NOW = new Date("2026-09-13T15:00:00Z");

describe("todayInTimeZone", () => {
  it("returns the calendar date in the given time zone", () => {
    expect(todayInTimeZone("UTC", NOW)).toBe("2026-09-13");
    expect(todayInTimeZone("Australia/Sydney", NOW)).toBe("2026-09-14");
    expect(todayInTimeZone("America/Los_Angeles", NOW)).toBe("2026-09-13");
  });

  it("falls back to UTC for an unknown time zone", () => {
    expect(todayInTimeZone("Not/AZone", NOW)).toBe("2026-09-13");
  });
});

describe("daysTogether", () => {
  it("is 0 on the first day", () => {
    expect(daysTogether("2026-09-13", "UTC", NOW)).toBe(0);
  });

  it("counts whole days", () => {
    expect(daysTogether("2024-05-10", "UTC", NOW)).toBe(856);
  });

  it("uses the viewer's time zone", () => {
    expect(daysTogether("2026-09-13", "Australia/Sydney", NOW)).toBe(1);
    expect(daysTogether("2026-09-13", "America/Los_Angeles", NOW)).toBe(0);
  });

  it("never goes negative for a future date", () => {
    expect(daysTogether("2026-12-25", "UTC", NOW)).toBe(0);
  });
});
