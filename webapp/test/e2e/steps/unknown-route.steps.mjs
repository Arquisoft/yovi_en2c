import { Given, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("I open an unknown route", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/this-route-does-not-exist`);
});

Then("I should land on the login route", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#login-username", { timeout: 15000 });

  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== "/") {
    throw new Error(`Expected "/", got "${pathname}"`);
  }
});