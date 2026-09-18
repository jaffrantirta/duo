import { expect, test } from "@playwright/test";
import { signInWithEmail } from "./helpers";

test("partners discover, match, and see the plan created", async ({ browser }) => {
  const stamp = Date.now();
  const jaffranEmail = `jaffran-discover-${stamp}@duo.test`;
  const sarahEmail = `sarah-discover-${stamp}@duo.test`;

  const jaffran = await (await browser.newContext()).newPage();
  const sarah = await (await browser.newContext()).newPage();

  // Pair up, same flow as pairing.spec.ts.
  await jaffran.goto("/sign-in");
  await signInWithEmail(jaffran, jaffranEmail);
  await jaffran.getByLabel("What should we call you?").fill("Jaffran");
  await jaffran.getByLabel("When did you two get together?").fill("2024-05-10");
  await jaffran.getByRole("button", { name: "Create our little world" }).click();
  await expect(jaffran.getByRole("heading", { name: "Waiting for your person" })).toBeVisible();
  const inviteLink = await jaffran.getByTestId("invite-url").inputValue();

  await sarah.goto(inviteLink);
  await signInWithEmail(sarah, sarahEmail);
  await sarah.getByLabel("What should we call you?").fill("Sarah");
  await sarah.getByRole("button", { name: "Join Jaffran" }).click();
  await expect(sarah).toHaveURL(/\/home$/);

  // Jaffran adds a custom idea — that's their own implicit yes.
  await jaffran.goto("/discover");
  await jaffran.getByRole("link", { name: "+ Add idea" }).click();
  await jaffran.getByRole("button", { name: "Movie" }).click();
  await jaffran.getByLabel("What is it?").fill("Rewatch our first movie");
  await jaffran.getByLabel("Say a bit more").fill("The one we saw on our first date.");
  await jaffran.getByRole("button", { name: "Add to your deck" }).click();
  await expect(jaffran).toHaveURL(/\/discover$/);

  // It doesn't show back up in Jaffran's own deck.
  await expect(jaffran.getByText("You're all caught up")).toBeVisible();

  // Sarah sees it and says yes too — instant match.
  await sarah.goto("/discover");
  await expect(sarah.getByRole("heading", { name: "Rewatch our first movie" })).toBeVisible();
  await sarah.getByRole("button", { name: "Yes" }).click();
  await expect(sarah).toHaveURL(/\/discover\?matched=1$/);
  await expect(sarah.getByText("It's a match!")).toBeVisible();

  // The match is now a shared plan for both partners, immediately.
  await sarah.goto("/plans");
  await expect(sarah.getByText("Rewatch our first movie")).toBeVisible();
  await jaffran.goto("/plans");
  await expect(jaffran.getByText("Rewatch our first movie")).toBeVisible();
});
