import { When, Then } from "@cucumber/cucumber";

When("I switch the language to English", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: "EN" }).click();
});

When("I switch the language to Spanish", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  await page.getByRole("button", { name: "ES" }).click();
});

Then("the English language button should be active", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const pressed = await page.getByRole("button", { name: "EN" }).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`Expected EN aria-pressed=true, got ${pressed}`);
  }
});

Then("the Spanish language button should be active", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const pressed = await page.getByRole("button", { name: "ES" }).getAttribute("aria-pressed");
  if (pressed !== "true") {
    throw new Error(`Expected ES aria-pressed=true, got ${pressed}`);
  }
});