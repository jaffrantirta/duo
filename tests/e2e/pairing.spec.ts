import { readFile } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

async function readMagicLink(email: string): Promise<string> {
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

async function signInWithEmail(page: Page, email: string) {
  await page.getByLabel("Email").fill(email);
  await page.getByRole("button", { name: "Email me a link" }).click();
  await expect(page.getByRole("heading", { name: "Check your inbox" })).toBeVisible();
  await page.goto(await readMagicLink(email));
}

test("two people sign up, pair with an invite link and share a home", async ({ browser }) => {
  const stamp = Date.now();
  const jaffranEmail = `jaffran-${stamp}@duo.test`;
  const sarahEmail = `sarah-${stamp}@duo.test`;

  const jaffran = await (await browser.newContext()).newPage();
  const sarah = await (await browser.newContext()).newPage();

  // Jaffran signs up and creates the couple
  await jaffran.goto("/");
  await expect(jaffran).toHaveURL(/\/sign-in$/);
  await signInWithEmail(jaffran, jaffranEmail);
  await expect(jaffran).toHaveURL(/\/onboarding$/);
  await jaffran.getByLabel("What should we call you?").fill("Jaffran");
  await jaffran.getByLabel("When did you two get together?").fill("2024-05-10");
  await jaffran.getByRole("button", { name: "Create our little world" }).click();
  await expect(jaffran.getByRole("heading", { name: "Waiting for your person" })).toBeVisible();
  const inviteLink = await jaffran.getByTestId("invite-url").inputValue();
  expect(inviteLink).toMatch(/\/invite\/[A-Za-z0-9_-]{43}$/);

  // Jaffran cannot accept their own invite
  await jaffran.goto(inviteLink);
  await expect(jaffran.getByRole("heading", { name: "This is your own invite" })).toBeVisible();

  // Sarah opens the link, signs in and joins
  await sarah.goto(inviteLink);
  await expect(sarah.getByRole("heading", { name: "Jaffran invited you to Duo" })).toBeVisible();
  await signInWithEmail(sarah, sarahEmail);
  await expect(sarah).toHaveURL(/\/invite\//);
  await sarah.getByLabel("What should we call you?").fill("Sarah");
  await sarah.getByRole("button", { name: "Join Jaffran" }).click();

  // Both see the shared home
  await expect(sarah).toHaveURL(/\/home$/);
  await expect(sarah.getByTestId("couple-names")).toHaveText(/Jaffran.*Sarah/);
  await expect(sarah.getByText(/together for/)).toBeVisible();

  await jaffran.goto("/home");
  await expect(jaffran.getByTestId("couple-names")).toHaveText(/Jaffran.*Sarah/);

  // The link is now spent
  const stranger = await (await browser.newContext()).newPage();
  await stranger.goto("/sign-in");
  await signInWithEmail(stranger, `stranger-${stamp}@duo.test`);
  await stranger.goto(inviteLink);
  await expect(stranger.getByRole("heading", { name: "This link was already used" })).toBeVisible();
});
