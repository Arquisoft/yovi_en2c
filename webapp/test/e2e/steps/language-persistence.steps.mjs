import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "http://localhost:5173";

Given("the home page is open", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/home`);
});

Then("the English language should persist after reload", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const pressed = await page.getByRole("button", { name: "EN" }).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`Expected English to persist, got aria-pressed=${pressed}`);
  }
});