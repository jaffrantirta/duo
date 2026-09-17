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

test("a signed-in visit to / redirects away from the landing page", async ({ page }) => {
  const email = `landing-redirect-${Date.now()}@duo.test`;

  await page.goto("/sign-in");
  await signInWithEmail(page, email);
  await expect(page).toHaveURL(/\/onboarding$/);

  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
});
