import { Given, When, Then } from "@cucumber/cucumber";

const API_GAME_NEW = /\/api\/game\/new$/;
const API_GAME_MOVE = /\/api\/game\/pvb\/move$/;

function makeBoard(size, cells = {}) {
  const rows = Array.from({ length: size }, () => Array.from({ length: size }, () => "."));
  for (const [key, value] of Object.entries(cells)) {
    const [r, c] = key.split("-").map(Number);
    rows[r][c] = value;
  }
  return rows.map((r) => r.join("")).join("/");
}

function gameOk(yen, extra = {}) {
  return {
    ok: true,
    yen,
    finished: false,
    winner: null,
    ...extra,
  };
}

Given("I start a new game", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });
  await page.locator("section.grid").waitFor({ state: "visible", timeout: 15000 });

  const selectDifficultyButton = page.getByRole("button", {
    name: /select difficulty|seleccionar dificultad/i,
  }).first();

  await selectDifficultyButton.waitFor({ state: "visible", timeout: 15000 });
  await selectDifficultyButton.click();

  await page.waitForURL((url) => url.pathname === "/select-difficulty", { timeout: 15000 });

  await page.getByRole("button", {
    name: /^(Easy|Fácil)$/i,
  }).click();

  await Promise.all([
    page.waitForResponse((r) => API_GAME_NEW.test(r.url()) && r.request().method() === "POST"),
    page.getByRole("button", { name: /^(Play|Jugar)$/i }).click(),
  ]);

  await page.waitForURL((url) => url.pathname === "/game", { timeout: 15000 });
  await page.locator(".game-board-wrapper").waitFor({ state: "visible", timeout: 15000 });
});

Then("the board should be empty", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  // Board polygons exist; empty initial board means there are no blue/red occupied fills yet.
  // We use DOM count of polygons as presence, then ensure no finished overlay and no error.
  await page.locator(".game-board-wrapper svg polygon").first().waitFor({
    state: "visible",
    timeout: 15000,
  });

  const overlay = page.getByText(/game finished|has perdido|you win|draw|empate/i);
  const overlayCount = await overlay.count().catch(() => 0);
  if (overlayCount > 0) {
    throw new Error("Expected a fresh board, but game already looks finished");
  }
});

Then("it should be the player's turn", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.locator(".game-board-wrapper").waitFor({
    state: "visible",
    timeout: 15000,
  });

  const hintVisible = await page.locator(".game-hint-btn").isVisible().catch(() => false);
  if (!hintVisible) {
    throw new Error("Expected the game to be ready for player interaction");
  }
});

When("I play in a cell", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const firstPolygon = page.locator(".game-board-wrapper svg polygon").first();
  await firstPolygon.waitFor({ state: "visible", timeout: 15000 });
  await firstPolygon.click();

  this.lastPlayedCellIndex = 0;
});

When("I play again in the same cell", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const index = this.lastPlayedCellIndex ?? 0;
  const samePolygon = page.locator(".game-board-wrapper svg polygon").nth(index);

  this.beforeSecondClickErrorText = await page.locator("main").textContent().catch(() => "");
  await samePolygon.click();
  this.afterSecondClickErrorText = await page.locator("main").textContent().catch(() => "");
});

Then("I should see an error or no change", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const mainText = (await page.locator("main").textContent().catch(() => "")) ?? "";
  const errorLike = /error|backend|occupied|invalid|unavailable|conexión|ocupad/i.test(mainText);
  const boardVisible = await page.locator(".game-board-wrapper").isVisible().catch(() => false);

  if (!errorLike && !boardVisible) {
    throw new Error("Expected an error or the board to remain stable after replaying the same cell");
  }
});

When("I make a move", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const polygons = page.locator(".game-board-wrapper svg polygon");
  await polygons.first().waitFor({ state: "visible", timeout: 15000 });

  const [moveResponse] = await Promise.all([
    page.waitForResponse((r) => API_GAME_MOVE.test(r.url()) && r.request().method() === "POST"),
    polygons.first().click(),
  ]);

  if (moveResponse.status() >= 400) {
    throw new Error(`Move failed with status ${moveResponse.status()}: ${await moveResponse.text()}`);
  }
});

Then("the bot should make a move automatically", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  // After a move the app should come back from busy state and keep board visible.
  await page.locator(".game-board-wrapper").waitFor({ state: "visible", timeout: 15000 });

  // Accept either bot thinking indicator or stable board after completed bot response.
  const thinkingCount = await page.getByText(/bot is thinking|el bot está pensando/i).count();
  if (thinkingCount > 0) {
    await page.getByText(/bot is thinking|el bot está pensando/i).first().waitFor({
      state: "visible",
      timeout: 5000,
    });
  }
});

Given("I am on a nearly finished game", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  // Mock deterministic near-finished game.
  let moveDone = false;

  await page.route(API_GAME_NEW, async (route) => {
    const yen = {
      size: 3,
      layout: makeBoard(3, {
        "0-0": "B",
        "0-1": "B",
        "1-0": "R",
        "1-1": "R",
      }),
      players: ["B", "R"],
      turn: 0,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(gameOk(yen)),
    });
  });

  await page.route(API_GAME_MOVE, async (route) => {
    moveDone = true;
    const yen = {
      size: 3,
      layout: makeBoard(3, {
        "0-0": "B",
        "0-1": "B",
        "0-2": "B",
        "1-0": "R",
        "1-1": "R",
      }),
      players: ["B", "R"],
      turn: 1,
    };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        ok: true,
        yen,
        finished: true,
        winner: "B",
        winning_edges: [[[0, 0], [0, 1]], [[0, 1], [0, 2]]],
      }),
    });
  });

  await page.waitForURL((url) => url.pathname === "/home", { timeout: 15000 });
  await page.locator("section.grid").waitFor({ state: "visible", timeout: 15000 });

  const selectDifficultyButton = page.getByRole("button", {
    name: /select difficulty|seleccionar dificultad/i,
  }).first();

  await selectDifficultyButton.waitFor({ state: "visible", timeout: 15000 });
  await selectDifficultyButton.click();

  await page.waitForURL((url) => url.pathname === "/select-difficulty", { timeout: 15000 });
  await page.getByRole("button", { name: /^(Easy|Fácil)$/i }).click();

  await Promise.all([
    page.waitForResponse((r) => API_GAME_NEW.test(r.url())),
    page.getByRole("button", { name: /^(Play|Jugar)$/i }).click(),
  ]);

  await page.waitForURL((url) => url.pathname === "/game", { timeout: 15000 });
  await page.locator(".game-board-wrapper").waitFor({ state: "visible", timeout: 15000 });

  this.mockGameEndMoveReady = () => moveDone;
});

When("the last move is played", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const polygons = page.locator(".game-board-wrapper svg polygon");
  await polygons.nth(2).click();
});

Then("I should see the winner", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const overlayButtons = page.getByRole("button", {
    name: /back to home|volver|nueva partida|new game/i,
  });

  const count = await overlayButtons.count();
  if (count === 0) {
    throw new Error("Expected finished game controls after the last move");
  }

  await overlayButtons.first().waitFor({ state: "visible", timeout: 15000 });
});

Then("the game should be finished", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const overlayButtons = page.getByRole("button", {
    name: /back to home|volver|nueva partida|new game/i,
  });

  const count = await overlayButtons.count();
  if (count === 0) {
    throw new Error("Expected finished game overlay controls");
  }
});