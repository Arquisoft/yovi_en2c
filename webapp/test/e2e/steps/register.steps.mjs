import { Given, When, Then } from '@cucumber/cucumber';

Given('the register page is open', async function () {
  const page = this.page;
  if (!page) throw new Error('Page not initialized');
  await page.goto('http://localhost:5173');
  await page.waitForSelector('#username', { timeout: 5000 });
});

When('I enter {string} as the username and submit', async function (username) {
  const page = this.page;
  if (!page) throw new Error('Page not initialized');
  
  await page.fill('#username', username);
  await page.click('.submit-button');
});

Then('I should be redirected to the game page', async function () {
  const page = this.page;
  if (!page) throw new Error('Page not initialized');

  await page.waitForURL('**/game', { timeout: 10000 });
  
  const url = page.url();
  if (!url.includes('/game')) {
    throw new Error(`Expected URL to contain '/game', but got: ${url}`);
  }
});