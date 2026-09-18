import { expect, test } from "@playwright/test";
import { signInWithEmail } from "./helpers";

test("landing page explains the features and captures a waitlist email, with no sign-in link", async ({
  page,
}) => {
  await page.goto("/");

  await expect(page.getByText("A little world for the two of you.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Our Plans" })).toBeVisible();
  await expect(page.getByText("Coming soon").first()).toBeVisible();

  await expect(page.getByRole("link", { name: /sign in/i })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /sign in/i })).toHaveCount(0);

  const email = `waitlist-${Date.now()}@duo.test`;
  await page.getByLabel("Email").first().fill(email);
  await page.getByRole("button", { name: "Join the waitlist" }).first().click();

  await expect(page.getByText("You're on the list")).toBeVisible();
});

test("a validation error keeps the typed email in the field", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Email").first().fill("a@b");
  await page.getByRole("button", { name: "Join the waitlist" }).first().click();
  await expect(page.getByText("Enter a valid email")).toBeVisible();
  await expect(page.getByLabel("Email").first()).toHaveValue("a@b");
});

test("a freshly signed-up user visiting / is still routed into onboarding", async ({ page }) => {
  const email = `landing-onboarding-${Date.now()}@duo.test`;

  await page.goto("/sign-in");
  await signInWithEmail(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
});

test("an already-paired signed-in user visiting / sees the landing page, not the dashboard", async ({ page }) => {
  const email = `landing-paired-${Date.now()}@duo.test`;

  await page.goto("/sign-in");
  await signInWithEmail(page, email);
  await page.getByLabel("What should we call you?").fill("Paired Visitor");
  await page.getByLabel("When did you two get together?").fill("2024-05-10");
  await page.getByRole("button", { name: "Create our little world" }).click();
  await expect(page.getByRole("heading", { name: "Waiting for your person" })).toBeVisible();

  await page.goto("/");
  await expect(page).toHaveURL("/");
  await expect(page.getByText("A little world for the two of you.")).toBeVisible();
});
