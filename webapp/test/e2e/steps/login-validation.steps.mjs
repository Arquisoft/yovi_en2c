import { When, Then } from "@cucumber/cucumber";

When("I submit the login form without username", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.fill("#login-password", "123456");
  await page.locator(".submit-button").click();
});

When("I submit the login form without password", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.fill("#login-username", "Alice");
  await page.locator(".submit-button").click();
});

Then("I should see a login error message", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const error = page.locator(".error-message");
  await error.waitFor({ state: "visible", timeout: 15000 });

  const text = await error.textContent();
  if (!text || !text.trim()) {
    throw new Error("Expected a visible non-empty login error message");
  }
});