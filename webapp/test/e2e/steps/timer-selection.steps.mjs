import { When } from "@cucumber/cucumber";

When('I choose the timer {string}', async function (label) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: new RegExp(label, "i") }).click();
});