import { Given, Then } from "@cucumber/cucumber";

Given("the statistics request fails", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const username =
    this.createdUser?.username ??
    (await page.evaluate(() => localStorage.getItem("username"))) ??
    "Player";

  await page.route(new RegExp(`/api/stats/${username}\\??.*$`), async (route) => {
    await route.fulfill({
      status: 500,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: "Internal Server Error",
      }),
    });
  });
});

Then("I should see a statistics error", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.waitForURL((url) => url.pathname === "/statistics", { timeout: 15000 });

  const patterns = [
    /internal server error/i,
    /failed to load statistics/i,
    /network error/i,
    /retry/i,
    /error interno del servidor/i,
    /error al cargar las estadísticas/i,
    /error de red/i,
    /reintentar/i,
  ];

  let found = false;

  for (const pattern of patterns) {
    const locator = page.getByText(pattern);
    try {
      await locator.first().waitFor({ state: "visible", timeout: 15000 });
      found = true;
      break;
    } catch {
    }
  }

  if (!found) {
    throw new Error("Expected statistics error state");
  }
});