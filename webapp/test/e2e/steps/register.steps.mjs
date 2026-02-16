import { Given, When, Then } from '@cucumber/cucumber'

Given('the register page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto('http://localhost:5173')
})

When('I enter {string} as the username and submit', async function (username) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.fill('#username', username)
  await page.click('.submit-button')
})

Then('I should be redirected to the game page', async function (expected) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.waitForURL('**/game', { timeout: 15000 })
})
