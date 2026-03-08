import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("the register page is open", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector("#register-username", { timeout: 5000 });
});

When(
  'I enter {string} as the username, {string} as the email and {string} as the password and submit',
  async function (username, email, password) {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.fill("#register-username", username);
    await page.fill("#register-email", email);
    await page.fill("#register-password", password);
    await page.click(".submit-button");
  }
);

Then("I should be redirected to the login page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL("**/", { timeout: 10000 });

  const url = page.url();
  const normalized = new URL(url).pathname;

  if (normalized !== "/") {
    throw new Error(`Expected path to be "/", but got: ${normalized}`);
  }
});