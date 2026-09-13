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

  it("rejects values with embedded control characters or backslashes that the URL parser would reinterpret as a host", () => {
    expect(safeCallbackPath("/\t/evil.example")).toBe("/");
    expect(safeCallbackPath("/\n/evil.example")).toBe("/");
    expect(safeCallbackPath("/\r/evil.example")).toBe("/");
    expect(safeCallbackPath("/foo\\bar")).toBe("/");
    expect(safeCallbackPath("/ x")).toBe("/");
  });

  it("keeps a normal path with a query string", () => {
    expect(safeCallbackPath("/invite/abc?x=1")).toBe("/invite/abc?x=1");
  });
});
