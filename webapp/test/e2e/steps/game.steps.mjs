import { Given, When, Then } from "@cucumber/cucumber";
import {loginAs} from "./shared.steps.mjs";

const BASE_URL = process.env.BASE_URL || "https://gameofy.publicvm.com";
async function goToGamePage(page, username, botId, boardSize) {
    console.log("🚀 [goToGamePage] START");
    console.log("➡️ BASE_URL:", BASE_URL);
    console.log("👤 USERNAME:", username);
    console.log("🤖 BOT:", botId);
    console.log("📏 BOARD SIZE:", boardSize);
    await loginAs(page, "prueba1", "prueba1")

    await loginAs(page, "prueba1", "prueba1");

// wait for login to complete UI transition
    await page.waitForURL("**/home", { timeout: 10000 });

    console.log("⏳ Waiting for <body>...");
    await page.waitForSelector("body", { timeout: 10000 });

    // DOM snapshot for debugging (very useful for your 404 issue)
    const html = await page.content();
    console.log("🧾 DOM SNAPSHOT (first 300 chars):");
    console.log(html.slice(0, 1000));

    console.log("🔍 Looking for bot card...");
    const botCard = page.locator('[data-testid="bot-card"]');

    try {
        await botCard.waitFor({ timeout: 10000 });
        console.log("✅ bot-card found");
    } catch (err) {
        console.log("❌ bot-card NOT found");
        console.log("📍 Current URL:", page.url());
        throw err;
    }

    console.log("🖱️ Clicking bot card...");
    await botCard.click();

    console.log("⚙️ Selecting bot:", botId);
    await page.locator("select").first().selectOption(botId);

    console.log("⚙️ Selecting board size:", boardSize);
    await page.locator("select").last().selectOption(String(boardSize));

    console.log("🚀 Clicking start button...");
    const startBtn = page.locator(
        'button:has-text("Start"), button:has-text("Jugar"), button:has-text("Empezar")'
    );

    await startBtn.click();

    console.log("⏳ Waiting for /game navigation...");
    await page.waitForURL("**/game", { timeout: 10000 });

    console.log("🎮 SUCCESS: Arrived at game page:", page.url());
}

Given(
    "a game is in progress with bot {string} and board size {string}",
    async function (botId, boardSize) {
        await goToGamePage(this.page, "Alice", botId, boardSize);

        await this.page.waitForSelector(".btn--primary", { timeout: 5000 });
        await this.page.click(".btn--primary");

        await this.page.waitForSelector("svg circle", { timeout: 8000 });
    }
);

When(
    "I navigate to the game page with bot {string} and board size {string}",
    async function (botId, boardSize) {
        await goToGamePage(this.page, "Alice", botId, boardSize);
    }
);

When("I click the new game button", async function () {
    await this.page.click(".btn--primary");
    await this.page.waitForTimeout(1500);
});

When("I click an empty cell on the board", async function () {
    const circle = await this.page.waitForSelector(
        'svg circle[fill="#b0aa9f"]',
        { timeout: 5000 }
    );

    await circle.click();
    this._clickedCircle = circle;
});

When("I click the back button", async function () {
    await this.page.click(
        '.btn--outline:has-text("←"), .btn--outline:has-text("Atrás"), .btn--outline:has-text("Volver")'
    );
});

Then("I should see the start game prompt", async function () {
    await this.page.waitForSelector('span:has-text("🎮")', { timeout: 5000 });
});

Then("the send move button should not be visible", async function () {
    const btn = await this.page.$('button:has-text("Send"), button:has-text("Enviar")');
    if (btn) throw new Error("Send button should not exist yet");
});

Then("the send move button should be visible", async function () {
    await this.page.waitForSelector(
        'button:has-text("Send"), button:has-text("Enviar"), button:has-text("Mover")',
        { timeout: 5000 }
    );
});

Then("the game board should be visible", async function () {
    await this.page.waitForSelector(".game-board-wrap", { timeout: 8000 });
});

Then("the board should contain circles", async function () {
    const circles = await this.page.$$("svg circle");
    if (circles.length === 0) throw new Error("No circles found");
});

Then("that cell should appear selected", async function () {
    const selected = await this.page.$('svg circle[fill="#d4782a"]');
    if (!selected) throw new Error("No selected cell found");
});

Then("I should be on the home page", async function () {
    await this.page.waitForURL("**/home", { timeout: 5000 });

    const url = new URL(this.page.url()).pathname;
    if (url !== "/home") {
        throw new Error(`Expected /home but got ${url}`);
    }
});

Then("I should see the board size label {string}", async function (label) {
    await this.page.waitForSelector(
        `.game-toolbar span:has-text("${label}")`,
        { timeout: 5000 }
    );
});