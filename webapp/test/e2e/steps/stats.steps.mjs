import { When, Then } from "@cucumber/cucumber";

When("I click the statistics button on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const grid = page.locator("section.grid");
  await grid.waitFor({ state: "visible", timeout: 15000 });

  const buttons = grid.locator("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const text = await buttons.nth(i).textContent();
    if (text && /statistics|estadísticas/i.test(text)) {
      await buttons.nth(i).click();
      return;
    }
  }

  throw new Error("Statistics button on home page not found");
});

Then("I should be on the statistics page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/statistics", { timeout: 15000 });
});