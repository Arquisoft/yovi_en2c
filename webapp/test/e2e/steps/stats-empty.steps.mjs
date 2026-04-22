import { Given, Then } from "@cucumber/cucumber";

Given("my statistics are empty", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username =
    this.createdUser?.username ??
    (await page.evaluate(() => localStorage.getItem("username"))) ??
    "Player";

  await page.route(new RegExp(`/api/stats/${username}\\??.*$`), async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        success: true,
        stats: {
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          pvbGames: 0,
          pvpGames: 0,
          lastFive: [],
        },
        games: [],
      }),
    });
  });
});

Then("I should see the empty statistics state", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const patterns = [
    /no games yet/i,
    /play your first game/i,
    /no hay partidas/i,
    /juega tu primera partida/i,
  ];

  let found = false;

  for (const pattern of patterns) {
    const locator = page.getByText(pattern);
    const count = await locator.count().catch(() => 0);
    if (count > 0) {
      await locator.first().waitFor({ state: "visible", timeout: 15000 });
      found = true;
      break;
    }
  }

  if (!found) {
    throw new Error("Expected empty statistics state");
  }
});