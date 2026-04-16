import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("the login page is open", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/`);
  await page.waitForSelector("#login-username");
  await page.waitForSelector("#login-password");
});

When("I register a new valid user", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const uniqueSuffix = Date.now();
  const username = `Alice_${uniqueSuffix}`;
  const email = `alice_${uniqueSuffix}@uniovi.es`;
  const password = "123456";

  this.createdUser = { username, email, password };

  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector("#register-username");

  await page.fill("#register-username", username);
  await page.fill("#register-email", email);
  await page.fill("#register-password", password);
  await page.fill("#register-repeat-password", password);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/register")),
    page.locator(".submit-button").click(),
  ]);

  console.log("REGISTER STATUS:", response.status());
  console.log("REGISTER BODY:", await response.text());

  await page.waitForSelector("#login-username", { timeout: 15000 });
});

When("I log in with that registered user", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");
  if (!this.createdUser) throw new Error("No created user found in test context");

  await page.fill("#login-username", this.createdUser.username);
  await page.fill("#login-password", this.createdUser.password);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes("/api/login")),
    page.locator(".submit-button").click(),
  ]);

  console.log("LOGIN STATUS:", response.status());
  console.log("LOGIN BODY:", await response.text());
});

Then("I should be redirected to the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });
});