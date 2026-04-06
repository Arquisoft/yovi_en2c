import { Given, When, Then } from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "https://gameofy.publicvm.com";
// Unique suffix per CI run so the same username is never re-used across runs.
const RUN_ID = Date.now();
Given("the register page is open", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    // 1️⃣ Go to homepage (or login page)
    await page.goto(BASE_URL, { waitUntil: "networkidle" });

    // 2️⃣ Wait a tiny bit for React hydration
    await page.waitForTimeout(1500);

    // 3️⃣ Use page.locator() to find the button
    const registerBtn = page.locator('button.text-link'); // selector string, returns Locator

    // ✅ Correct: call .waitFor() on the Locator
    await registerBtn.waitFor({ state: "visible", timeout: 10000 });

    // 4️⃣ Click the button
    await registerBtn.click();

    // 5️⃣ Wait for the registration input to appear
    await page.waitForSelector("#reg-user", { timeout: 10000 });

    console.log("Registration page is ready");
});
When(
    'I enter {string} as the username, {string} as the email and {string} as the password and submit',
    async function (username, email, password) {
        const page = this.page;
        if (!page) throw new Error("Page not initialized");

        const RUN_ID = Date.now();
        const uniqueUsername = `${username}_${RUN_ID}`;

        await page.fill("#reg-user", uniqueUsername);   // <-- updated
        await page.fill("#reg-email", email);          // <-- updated
        await page.fill("#reg-pw", password);          // <-- updated
        await page.click(".btn--primary");             // submit button selector
    }
);

Then("I should be redirected to the login page", async function () {
    const page = this.page;
    if (!page) throw new Error("Page not initialized");

    await page.waitForURL("**/", { timeout: 10000 });

    const url = page.url();
    const normalized = new URL(url).pathname;

    if (normalized !== "/") {
        throw new Error(`Expected path to be "/", but got: ${normalized}`);
    }
});
