import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { sendMagicLinkEmail } from "@/lib/email";

describe("sendMagicLinkEmail", () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), "duo-mail-"));
    vi.spyOn(process, "cwd").mockReturnValue(dir);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    await rm(dir, { recursive: true, force: true });
  });

  it("writes the link to .e2e-mail/<email>.txt when EMAIL_TRANSPORT=file", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
    const url = "http://localhost:3000/api/auth/magic-link/verify?token=abc";

    await sendMagicLinkEmail({ to: "sarah@duo.test", url });

    expect(await readFile(path.join(dir, ".e2e-mail", "sarah@duo.test.txt"), "utf8")).toBe(url);
  });

  it("never uses the file transport when NODE_ENV is production", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendMagicLinkEmail({ to: "a@duo.test", url: "http://x" })).rejects.toThrow(
      "RESEND_API_KEY and EMAIL_FROM must be set",
    );
  });

  it("never uses the file transport in production", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("RESEND_API_KEY", "");
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendMagicLinkEmail({ to: "a@duo.test", url: "http://x" })).rejects.toThrow(
      "RESEND_API_KEY and EMAIL_FROM must be set",
    );
  });
});
