import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import nodemailer from "nodemailer";

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }): Promise<void> {
  if (
    process.env.EMAIL_TRANSPORT === "file" &&
    process.env.VERCEL_ENV !== "production" &&
    process.env.NODE_ENV !== "production"
  ) {
    const dir = path.join(process.cwd(), ".e2e-mail");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${to.replace(/[^a-zA-Z0-9@._+-]/g, "_")}.txt`), url, "utf8");
    return;
  }

  const host = process.env.SMTP_HOST;
  const port = process.env.SMTP_PORT;
  const user = process.env.SMTP_USERNAME;
  const pass = process.env.SMTP_PASSWORD;
  const from = process.env.EMAIL_FROM;
  if (!host || !port || !user || !pass || !from) {
    throw new Error("SMTP_HOST, SMTP_PORT, SMTP_USERNAME, SMTP_PASSWORD and EMAIL_FROM must be set");
  }

  const transport = nodemailer.createTransport({
    host,
    port: Number(port),
    secure: process.env.SMTP_SECURE === "true",
    auth: { user, pass },
  });

  try {
    await transport.sendMail({
      from,
      to,
      subject: "Your Duo sign-in link 💌",
      text: `Tap to sign in to Duo:\n\n${url}\n\nThis link expires in 15 minutes.`,
      html: magicLinkHtml(url),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`SMTP send failed: ${message}`);
  }
}

function magicLinkHtml(url: string): string {
  const href = url.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  return `<div style="font-family:-apple-system,Segoe UI,sans-serif;background:#FBF8F3;padding:32px;color:#1F1B16">
  <p style="font-size:28px;font-weight:700;margin:0 0 16px">duo</p>
  <p style="font-size:16px;margin:0 0 24px">Tap the button to sign in. The link expires in 15 minutes.</p>
  <a href="${href}" style="display:inline-block;background:#1F1B16;color:#FBF8F3;padding:14px 22px;border-radius:16px;text-decoration:none;font-weight:600">Sign in to Duo</a>
  <p style="font-size:13px;color:#6B6258;margin:24px 0 0">If you didn't ask for this, you can ignore this email.</p>
</div>`;
}
