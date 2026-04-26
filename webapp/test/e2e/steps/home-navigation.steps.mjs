import { When, Then } from "@cucumber/cucumber";

When("I click the local play card on the home page", async function () {
  await this.page.getByRole("button", {
    name: /jugar en local|local play|play locally|select difficulty|seleccionar dificultad/i,
  }).first().click();
});

When("I click the multiplayer card on the home page", async function () {
  await this.page.getByRole("button", {
    name: /multiplayer|multijugador|jugar online|online/i,
  }).first().click();
});

When("I click the social card on the home page", async function () {
  await this.page.getByRole("button", {
    name: /social|amigos|friends/i,
  }).first().click();
});

Then("I should be on the difficulty selection page", async function () {
  await this.page.waitForURL((url) => url.pathname === "/select-difficulty", {
    timeout: 15000,
  });
});

Then("I should be on the multiplayer page", async function () {
  await this.page.waitForURL((url) => url.pathname === "/multiplayer", {
    timeout: 15000,
  });
});

Then("I should be on the social page", async function () {
  await this.page.waitForURL((url) => url.pathname === "/social", {
    timeout: 15000,
  });
});