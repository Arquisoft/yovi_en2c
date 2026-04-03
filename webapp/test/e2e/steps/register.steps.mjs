import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("the register page is open", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector("#register-username");
  await page.waitForSelector("#register-email");
  await page.waitForSelector("#register-password");
  await page.waitForSelector("#register-repeat-password");
});

When(
  'I enter {string} as the username, {string} as the email, {string} as the password and {string} as the repeat password and submit',
  async function (username, email, password, repeatPassword) {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    const uniqueSuffix = Date.now();
    const uniqueUsername = `${username}_${uniqueSuffix}`;
    const uniqueEmail = email.replace("@", `_${uniqueSuffix}@`);

    await page.fill("#register-username", uniqueUsername);
    await page.fill("#register-email", uniqueEmail);
    await page.fill("#register-password", password);
    await page.fill("#register-repeat-password", repeatPassword);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes("/api/register")),
      page.locator(".submit-button").click(),
    ]);

    console.log("REGISTER STATUS:", response.status());
    console.log("REGISTER BODY:", await response.text());
    console.log("URL AFTER SUBMIT:", page.url());

    const errorMessage = page.locator(".error-message");
    if (await errorMessage.count()) {
      console.log("UI ERROR:", await errorMessage.textContent());
    }
  }
);

Then("I should be redirected to the login page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#login-username", { timeout: 15000 });

  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== "/") {
    throw new Error(`Expected path "/", got "${pathname}"`);
  }
});