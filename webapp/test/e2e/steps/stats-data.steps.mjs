import { Given, When, Then } from "@cucumber/cucumber";

Given("I play a game", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username = await page.evaluate(() => localStorage.getItem("username") ?? "Player");

  // Seed stats endpoint with one recorded game.
  await page.route(new RegExp(`/api/stats/${username}\\?`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        stats: {
          totalGames: 1,
          wins: 1,
          losses: 0,
          winRate: 100,
          pvbGames: 1,
          pvpGames: 0,
          lastFive: [
            {
              opponent: "heuristic_bot",
              result: "win",
              boardSize: 7,
              gameMode: "pvb",
              date: new Date().toISOString(),
            },
          ],
        },
        games: [
          {
            opponent: "heuristic_bot",
            result: "win",
            boardSize: 7,
            gameMode: "pvb",
            date: new Date().toISOString(),
          },
        ],
      }),
    });
  });
});

When("I go to the statistics page", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: /statistics|estadísticas/i }).click();
});

Then("I should see at least one game in history", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/statistics", { timeout: 15000 });

  const historyHeading = page.getByText(/match history|historial de partidas/i);
  await historyHeading.first().waitFor({ state: "visible", timeout: 15000 });

  const rows = page.locator("table tbody tr");
  const count = await rows.count();

  if (count < 1) {
    throw new Error("Expected at least one game row in statistics history");
  }
});