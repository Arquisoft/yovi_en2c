import { When, Then } from "@cucumber/cucumber";

When("I click the statistics button on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", {
    name: /statistics|estadísticas/i,
  }).click();
});

Then("I should be on the statistics page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/statistics", { timeout: 15000 });
});