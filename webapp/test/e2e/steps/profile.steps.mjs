import { When, Then } from "@cucumber/cucumber";

When("I go to my profile page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username =
    this.createdUser?.username ??
    (await page.evaluate(() => localStorage.getItem("username")));

  if (!username) {
    throw new Error("No username found in scenario context or localStorage");
  }

  await page.goto(`http://localhost:5173/profile/${encodeURIComponent(username)}`);
});

Then("I should be on my profile page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username =
    this.createdUser?.username ??
    (await page.evaluate(() => localStorage.getItem("username")));

  if (!username) {
    throw new Error("No username found in scenario context or localStorage");
  }

  await page.waitForURL(
    (url) => url.pathname === `/profile/${username}`,
    { timeout: 15000 }
  );
});