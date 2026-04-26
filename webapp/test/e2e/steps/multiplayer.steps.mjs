import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("the multiplayer backend is mocked", async function () {
  // Evita que Vite intente proxyear WebSockets reales durante el E2E
  await this.page.route("**/ws/**", async (route) => {
    await route.abort();
  });

  await this.page.route("**/socket.io/**", async (route) => {
    await route.abort();
  });

  await this.page.route("**/api/multiplayer/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname.endsWith("/room/create") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          room: {
            code: "ROOM123",
            size: 7,
          },
        }),
      });
    }

    if (url.pathname.endsWith("/room/join") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          ok: true,
          room: {
            code: "ROOM123",
            size: 7,
          },
        }),
      });
    }

    if (url.pathname.endsWith("/room/leave") && method === "POST") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ ok: true }),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ ok: true }),
    });
  });

  await this.page.route("**/api/hint", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        coords: { x: 0, y: 0 },
      }),
    });
  });
});

When("I go to the multiplayer page", async function () {
  await this.page.goto(`${BASE_URL}/multiplayer`);
});

When("I create a multiplayer room", async function () {
  const button = this.page.getByRole("button", {
    name: /create room|crear sala|create|crear/i,
  }).last();

  await button.waitFor({ state: "visible", timeout: 15000 });

  await Promise.all([
    this.page.waitForResponse(
      (r) =>
        r.url().includes("/api/multiplayer/room/create") &&
        r.request().method() === "POST"
    ),
    button.click(),
  ]);
});

When("I join multiplayer room {string}", async function (roomCode) {
  const tabOrButton = this.page.getByRole("button", {
    name: /join|unirse|entrar/i,
  }).first();

  if (await tabOrButton.isVisible().catch(() => false)) {
    await tabOrButton.click();
  }

  const input = this.page.locator("input[type='text'], input").first();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(roomCode);

  const button = this.page.getByRole("button", {
    name: /join room|unirse a sala|join|unirse|entrar/i,
  }).last();

  await Promise.all([
    this.page.waitForResponse(
      (r) =>
        r.url().includes("/api/multiplayer/room/join") &&
        r.request().method() === "POST"
    ),
    button.click(),
  ]);
});

Then("I should see the multiplayer lobby", async function () {
  await this.page.waitForURL((url) => url.pathname === "/multiplayer", {
    timeout: 15000,
  });

  await this.page.waitForLoadState("domcontentloaded");

  const bodyText = ((await this.page.locator("body").textContent()) ?? "").trim();

  if (!bodyText) {
    throw new Error("Expected multiplayer page to render some content");
  }

  const badStates = /not found|404|cannot get|no encontrado/i;
  if (badStates.test(bodyText)) {
    throw new Error(`Multiplayer page looks broken: ${bodyText}`);
  }
});

Then("I should be on the multiplayer game page", async function () {
  await this.page.waitForURL((url) => url.pathname === "/multiplayer/game", {
    timeout: 15000,
  });
});

Then("I should see the multiplayer board", async function () {
  await this.page.locator(".game-board-wrapper").waitFor({
    state: "visible",
    timeout: 15000,
  });

  await this.page.locator(".game-board-wrapper svg polygon").first().waitFor({
    state: "visible",
    timeout: 15000,
  });
});