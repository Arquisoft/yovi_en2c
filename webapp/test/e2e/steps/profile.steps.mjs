import { When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

When("I go to my profile page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  let username = this.createdUser?.username ?? this.socialState?.currentUser ?? null;

  if (!username) {
    try {
      username = await page.evaluate(() => localStorage.getItem("username"));
    } catch {
      username = null;
    }
  }

  if (!username) {
    await page.goto(BASE_URL);
    username = await page.evaluate(() => localStorage.getItem("username"));
  }

  if (!username) {
    throw new Error("No username found in scenario context or localStorage");
  }

  await page.goto(`${BASE_URL}/profile/${encodeURIComponent(username)}`);
});

Then("I should be on my profile page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  let username = this.createdUser?.username ?? this.socialState?.currentUser ?? null;

  if (!username) {
    try {
      username = await page.evaluate(() => localStorage.getItem("username"));
    } catch {
      username = null;
    }
  }

  if (!username) {
    throw new Error("No username found in scenario context or localStorage");
  }

  await page.waitForURL(
    (url) => url.pathname === `/profile/${username}`,
    { timeout: 15000 }
  );
});