import { readFile } from "node:fs/promises";
import { expect, type Page } from "@playwright/test";

export async function readMagicLink(email: string): Promise<string> {
  let link = "";
  await expect
    .poll(
      async () => {
        link = await readFile(`.e2e-mail/${email}.txt`, "utf8").then((s) => s.trim(), () => "");
        return link;
      },
      { timeout: 15_000 },
    )
    .not.toBe("");
  return link;
}

export async function signInWithEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await readMagicLink(email));
}
