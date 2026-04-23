import { Given} from "@cucumber/cucumber";

const BASE_URL = process.env.BASE_URL || "https://gameofy.publicvm.com";
const RUN_ID = Date.now();

async function loginAs(page, username, password) {
  if (!page) throw new Error("Page not initialized");

  await page.goto(`${BASE_URL}/`, { waitUntil: "networkidle" });

  console.log("CURRENT URL:", page.url());
  // Wait for React hydration (same trick that works in register)
  await page.waitForTimeout(1500);

  await page.waitForSelector("#login-user", { timeout: 10000 });

  await page.fill("#login-user", username);
  const value = await page.inputValue("#login-user");
  console.log("USERNAME FIELD VALUE:", value);

  await page.fill("#login-pw", password);
  const value2 = await page.inputValue("#login-pw");
  console.log("PASSWORD FIELD VALUE:", value2);

  page.on("request", req => {
    if (req.url().includes("/login")) {
      console.log("REQUEST BODY:", req.postData());
      console.log("HEADERS:", req.headers());
    }
  });

  page.on("response", async res => {
    if (res.url().includes("/login")) {
      console.log("STATUS:", res.status());
      console.log("RESPONSE:", await res.text());
    }
  });
  await page.click('button[type="submit"]');

  // ✅ DO NOT rely only on URL
  // Instead wait for something that proves login worked

  await page.waitForLoadState("networkidle");

}

// Exported so other step files can reuse it
export { loginAs, BASE_URL, RUN_ID };

Given("I am logged in as {string} with password {string}", async function (username, password) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");
  await loginAs(page, username, password);
});

Given("I am logged in as a brand new user", async function () {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");

  const uniqueUser = `testuser_${RUN_ID}`;

  await page.goto(`${BASE_URL}/register`);
  await page.waitForSelector("#reg-user", { timeout: 5000 });
  await page.fill("#reg-user", uniqueUser);
  await page.fill("#reg-email", `${uniqueUser}@test.com`);
  await page.fill("#reg-pw", "password123");
  await page.click('button[type="submit"]');
  await page.waitForURL("**/", { timeout: 10000 });

  await loginAs(page, uniqueUser, "password123");
});

Given("I navigate directly to {string}", async function (path) {
  const page = this.page;
  if (!page) throw new Error("Page not initialized");
  await page.goto(`${BASE_URL}${path}`);
});


