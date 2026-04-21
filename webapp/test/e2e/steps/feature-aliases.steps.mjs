import { Given, When, Then } from "@cucumber/cucumber";

When("I press play", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: /^(Play|Jugar)$/i }).click();
});

Then("I should be redirected to login", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#login-username", { timeout: 15000 });
});