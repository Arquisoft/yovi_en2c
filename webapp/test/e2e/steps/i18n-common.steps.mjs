import { Then } from "@cucumber/cucumber";

Then('I should see {string} on the page', async function (text) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const matches = page.getByText(new RegExp(text, "i"));

  const count = await matches.count();
  if (count === 0) {
    throw new Error(`Expected to find text "${text}" on the page, but found none`);
  }

  await matches.first().waitFor({ state: "visible", timeout: 15000 });
});