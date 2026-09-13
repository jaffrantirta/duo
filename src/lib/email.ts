import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { Resend } from "resend";

export async function sendMagicLinkEmail({ to, url }: { to: string; url: string }): Promise<void> {
  if (process.env.EMAIL_TRANSPORT === "file" && process.env.VERCEL_ENV !== "production") {
    const dir = path.join(process.cwd(), ".e2e-mail");
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, `${to.replace(/[^a-zA-Z0-9@._+-]/g, "_")}.txt`), url, "utf8");
    return;
  }

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) {
    throw new Error("RESEND_API_KEY and EMAIL_FROM must be set");
  }

  const { error } = await new Resend(apiKey).emails.send({
    from,
    to,
    subject: "Your Duo sign-in link 💌",
    text: `Tap to sign in to Duo:\n\n${url}\n\nThis link expires in 15 minutes.`,
    html: magicLinkHtml(url),
  });
  if (error) {
    throw new Error(`Resend failed: ${error.message}`);
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
