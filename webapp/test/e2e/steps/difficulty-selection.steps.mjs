import { When, Then } from "@cucumber/cucumber";

When("I go to the difficulty selection page", async function () {
  const page = this.page;

  await page.getByRole("button", {
    name: /select difficulty|seleccionar dificultad|new game|nuevo juego/i
  }).first().click();

  await page.waitForURL((url) => url.pathname === "/select-difficulty");
});

When('I choose the {string} difficulty', async function (difficulty) {
  const page = this.page;

  const map = {
    Easy: /^(Easy|Fácil)$/i,
    Medium: /^(Medium|Medio)$/i,
    Hard: /^(Hard|Difícil)$/i,
    Expert: /^(Expert|Experto)$/i,
    Extreme: /^(Extreme|Extremo)$/i,
  };

  const pattern = map[difficulty] ?? new RegExp(`^${difficulty}$`, "i");
  await page.getByRole("button", { name: pattern }).click();
});

When("I start the selected game", async function () {
  const page = this.page;

  await page.getByRole("button", { name: /play|jugar/i }).click();
});

Then("the play button should be enabled", async function () {
  const page = this.page;

  const btn = page.getByRole("button", { name: /play|jugar/i });
  if (await btn.isDisabled()) {
    throw new Error("Play button is disabled");
  }
});