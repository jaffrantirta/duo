import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import nodemailer from "nodemailer";
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
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("SMTP_USERNAME", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendMagicLinkEmail({ to: "a@duo.test", url: "http://x" })).rejects.toThrow(
      "SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and EMAIL_FROM must be set",
    );
  });

  it("never uses the file transport in production", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "file");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("SMTP_HOST", "");
    vi.stubEnv("SMTP_PORT", "");
    vi.stubEnv("SMTP_USERNAME", "");
    vi.stubEnv("SMTP_PASSWORD", "");
    vi.stubEnv("EMAIL_FROM", "");

    await expect(sendMagicLinkEmail({ to: "a@duo.test", url: "http://x" })).rejects.toThrow(
      "SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and EMAIL_FROM must be set",
    );
  });

  it("sends via SMTP with the configured transport settings", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USERNAME", "duo@example.com");
    vi.stubEnv("SMTP_PASSWORD", "hunter2");
    vi.stubEnv("SMTP_SECURE", "true");
    vi.stubEnv("EMAIL_FROM", "Duo <hello@example.com>");

    const sendMail = vi.fn().mockResolvedValue({});
    const createTransport = vi.spyOn(nodemailer, "createTransport").mockReturnValue({ sendMail } as never);

    await sendMagicLinkEmail({ to: "sarah@duo.test", url: "http://localhost:3000/verify?token=abc" });

    expect(createTransport).toHaveBeenCalledWith({
      host: "smtp.example.com",
      port: 587,
      secure: true,
      auth: { user: "duo@example.com", pass: "hunter2" },
    });
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Duo <hello@example.com>",
        to: "sarah@duo.test",
        subject: "Your Duo sign-in link 💌",
      }),
    );
  });

  it("wraps a failed SMTP send in a clear error", async () => {
    vi.stubEnv("EMAIL_TRANSPORT", "");
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "test");
    vi.stubEnv("SMTP_HOST", "smtp.example.com");
    vi.stubEnv("SMTP_PORT", "587");
    vi.stubEnv("SMTP_USERNAME", "duo@example.com");
    vi.stubEnv("SMTP_PASSWORD", "hunter2");
    vi.stubEnv("EMAIL_FROM", "Duo <hello@example.com>");

    vi.spyOn(nodemailer, "createTransport").mockReturnValue({
      sendMail: vi.fn().mockRejectedValue(new Error("connection refused")),
    } as never);

    await expect(sendMagicLinkEmail({ to: "sarah@duo.test", url: "http://x" })).rejects.toThrow(
      "SMTP send failed: connection refused",
    );
  });
});
