import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("I am not logged in", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.removeItem("username");
    localStorage.removeItem("token");
  });
});

Given("I have an invalid token in localStorage", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(BASE_URL);
  await page.evaluate(() => {
    localStorage.setItem("username", "FakeUser");
    localStorage.setItem("token", "invalid-token");
  });
});

Given("I am on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/home`);
});

When("I go to the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/home`);
});

When("I try to access the game page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/game`);
});

When("I click the logout button", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: /logout|salir/i }).click();
});

When("I refresh the page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.reload();
});

Then("I should still be on the home page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });
});

Then("I should see my username", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username =
    this.createdUser?.username ??
    (await page.evaluate(() => localStorage.getItem("username")));

  if (!username) {
    throw new Error("No username found in scenario context or localStorage");
  }

  await page.getByText(new RegExp(username, "i")).first().waitFor({
    state: "visible",
    timeout: 15000,
  });
});

Then("I should not be authenticated", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const auth = await page.evaluate(() => ({
    username: localStorage.getItem("username"),
    token: localStorage.getItem("token"),
  }));

  if (auth.username || auth.token) {
    throw new Error(`Expected no auth in localStorage, got ${JSON.stringify(auth)}`);
  }
});

Then("I should still see the page in English", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: "EN" }).waitFor({
    state: "visible",
    timeout: 15000,
  });

  const pressed = await page.getByRole("button", { name: "EN" }).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`Expected EN button active after reload, got aria-pressed=${pressed}`);
  }

  const englishHints = [
    /home/i,
    /logout/i,
    /statistics/i,
    /select difficulty/i,
    /hello/i,
  ];

  let found = false;
  for (const pattern of englishHints) {
    const count = await page.getByText(pattern).count().catch(() => 0);
    if (count > 0) {
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error("Expected to still see the page in English");
  }
});

Then("I should be redirected to login", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForSelector("#login-username", { timeout: 15000 });

  const pathname = await page.evaluate(() => window.location.pathname);
  if (pathname !== "/") {
    throw new Error(`Expected login path "/", got "${pathname}"`);
  }
});