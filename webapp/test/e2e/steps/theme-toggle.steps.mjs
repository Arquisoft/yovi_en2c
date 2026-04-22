import { When, Then } from "@cucumber/cucumber";

When("I switch the theme", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const themeButton = page.locator(".theme-toggle");
  await themeButton.waitFor({ state: "visible", timeout: 15000 });
  await themeButton.click();
});

When("I reload the page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.reload();
});

Then('the app theme should be {string}', async function (expectedTheme) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForFunction(
    (theme) => document.documentElement.getAttribute("data-theme") === theme,
    expectedTheme
  );

  const actualTheme = await page.evaluate(() =>
    document.documentElement.getAttribute("data-theme")
  );

  if (actualTheme !== expectedTheme) {
    throw new Error(`Expected theme "${expectedTheme}", got "${actualTheme}"`);
  }
});