import { Then } from "@cucumber/cucumber";

Then("I should see a register error message", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const error = page.locator(".error-message");
  await error.waitFor({ state: "visible", timeout: 15000 });

  const text = await error.textContent();
  if (!text || !text.trim()) {
    throw new Error("Expected a visible non-empty register error message");
  }
});