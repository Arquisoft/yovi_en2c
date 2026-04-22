import { When, Then } from "@cucumber/cucumber";

When("I click the instructions button on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const grid = page.locator("section.grid");
  await grid.waitFor({ state: "visible", timeout: 15000 });

  const buttons = grid.locator("button");
  const count = await buttons.count();

  for (let i = 0; i < count; i++) {
    const text = await buttons.nth(i).textContent();
    if (text && /instructions|instrucciones/i.test(text)) {
      await buttons.nth(i).click();
      return;
    }
  }

  throw new Error("Instructions button on home page not found");
});

Then("I should arrive at the instructions page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/instructions", { timeout: 15000 });
});