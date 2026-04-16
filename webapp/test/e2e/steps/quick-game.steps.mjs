import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("I am logged in with a newly registered user", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const uniqueSuffix = Date.now();
  const username = `Quick_${uniqueSuffix}`;
  const email = `quick_${uniqueSuffix}@uniovi.es`;
  const password = "123456";

  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector("#register-username");

  await page.fill("#register-username", username);
  await page.fill("#register-email", email);
  await page.fill("#register-password", password);
  await page.fill("#register-repeat-password", password);

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/register")),
    page.locator(".submit-button").click(),
  ]);

  await page.waitForSelector("#login-username", { timeout: 15000 });

  await page.fill("#login-username", username);
  await page.fill("#login-password", password);

  await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/login")),
    page.locator(".submit-button").click(),
  ]);

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });
});

When("I click the quick game button", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const hero = page.locator("section.hero");
  await hero.waitFor({ state: "visible", timeout: 15000 });

  const quickGameButton = hero.locator("button").first();
  await quickGameButton.click();
});

Then("I should be on the game page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/game", { timeout: 15000 });
});