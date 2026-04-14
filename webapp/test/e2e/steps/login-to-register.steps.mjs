import { When, Then } from "@cucumber/cucumber";

When("I click the go to register link", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("link").click();
});

Then("I should see the register page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#register-username", { timeout: 15000 });

  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== "/register") {
    throw new Error(`Expected path "/register", got "${pathname}"`);
  }
});