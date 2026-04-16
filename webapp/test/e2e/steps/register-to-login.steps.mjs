import { When, Then } from "@cucumber/cucumber";

When("I click the go to login link", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("link").click();
});

Then("I should see the login page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#login-username", { timeout: 15000 });

  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== "/") {
    throw new Error(`Expected path "/", got "${pathname}"`);
  }
});