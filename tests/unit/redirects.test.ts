import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "@/lib/redirects";

describe("safeCallbackPath", () => {
  it("keeps same-site relative paths", () => {
    expect(safeCallbackPath("/invite/abc_123")).toBe("/invite/abc_123");
  });

  it("rejects absolute and protocol-relative URLs", () => {
    expect(safeCallbackPath("https://evil.example")).toBe("/");
    expect(safeCallbackPath("//evil.example")).toBe("/");
    expect(safeCallbackPath("/\\evil.example")).toBe("/");
  });

  it("falls back for missing or non-string values", () => {
    expect(safeCallbackPath(undefined)).toBe("/");
    expect(safeCallbackPath(["/a", "/b"], "/home")).toBe("/home");
  });
});
