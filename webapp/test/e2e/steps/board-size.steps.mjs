import { When, Then } from "@cucumber/cucumber";

When('I choose the preset board size {string}', async function (size) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: new RegExp(`^${size}$`) }).click();
});

Then("the game board should be visible", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.locator(".board-container, .game-board-wrapper, svg").first().waitFor({
    state: "visible",
    timeout: 15000,
  });
});