import { When } from "@cucumber/cucumber";

When("I click the navbar home link", async function () {
  await this.page.getByRole("button", { name: /home|inicio/i }).first().click();
});

When("I click the navbar multiplayer link", async function () {
  await this.page.getByRole("button", { name: /multiplayer|multijugador/i }).first().click();
});

When("I click the navbar social link", async function () {
  await this.page.getByRole("button", { name: /social|amigos|friends/i }).first().click();
});

When("I click the navbar statistics link", async function () {
  await this.page.getByRole("button", { name: /statistics|estadísticas/i }).first().click();
});