import { Given, When, Then } from "@cucumber/cucumber";

Given("I am on a started game", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });

  await page.getByRole("button", {
    name: /select difficulty|seleccionar dificultad/i,
  }).click();

  await page.waitForURL((url) => url.pathname === "/select-difficulty", { timeout: 15000 });

  await page.getByRole("button", {
    name: /^(Easy|Fácil)$/i,
  }).click();

  const [gameNewResponse] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes("/api/game/new") && r.request().method() === "POST"
    ),
    page.getByRole("button", {
      name: /^(Play|Jugar)$/i,
    }).click(),
  ]);

  await page.waitForURL((url) => url.pathname === "/game", { timeout: 15000 });

  if (gameNewResponse.status() >= 400) {
    throw new Error(
      `Game creation failed with status ${gameNewResponse.status()}: ${await gameNewResponse.text()}`
    );
  }

  const errorMessage = page.locator("text=/game creation failed|backend error|connection error|error/i");
  if (await errorMessage.count()) {
    const text = await errorMessage.first().textContent();
    if (text?.trim()) {
      throw new Error(`Game page shows an error after creation: ${text}`);
    }
  }
});

When("I request a hint", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const hintButton = page.locator(".game-hint-btn");
  await hintButton.waitFor({ state: "visible", timeout: 15000 });
  await hintButton.click();
});

Then("the hint button should be visible", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.locator(".game-hint-btn").waitFor({ state: "visible", timeout: 15000 });
});

Then("the hint button should still be visible", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.locator(".game-hint-btn").waitFor({ state: "visible", timeout: 15000 });
});

When("I open the in-game instructions", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: /instructions|instrucciones/i }).click();
});

When("I wait until the game is ready for hints", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.locator(".game-board-wrapper").waitFor({
    state: "visible",
    timeout: 15000,
  });

  await page.waitForFunction(() => {
    return !!document.querySelector(".game-hint-btn");
  }, { timeout: 15000 });
});

Then("I should see the how-to-play section", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const matches = page.getByText(/how to play|cómo se juega/i);
  const count = await matches.count();

  if (count === 0) {
    throw new Error('Expected to find "How to play" / "Cómo se juega" on the page');
  }

  await matches.first().waitFor({ state: "visible", timeout: 15000 });
});