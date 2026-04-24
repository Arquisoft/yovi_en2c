import { Before, Given, When, Then } from "@cucumber/cucumber";
import assert from "node:assert/strict";

function buildProfile(username, overrides = {}) {
  return {
    username,
    realName: null,
    bio: "",
    location: { city: "", country: "" },
    preferredLanguage: "en",
    joinDate: "2025-01-01T00:00:00.000Z",
    stats: {
      totalGames: 0,
      wins: 0,
      losses: 0,
      winRate: 0,
    },
    recentMatches: [],
    friends: [],
    friendRequests: [],
    ...overrides,
  };
}

Before({ tags: "@social" }, async function () {
  this.socialState = {
    currentUser: "alice",
    searchResultsByQuery: {},
    requestStatuses: {},
    profiles: {
      alice: buildProfile("alice"),
    },
  };

  await this.page.addInitScript(() => {
    window.localStorage.setItem("username", "alice");
    window.localStorage.setItem("token", "fake-jwt-token");
  });

  await this.page.route("**/api/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method();

    if (url.pathname === "/api/search" && method === "GET") {
      const q = url.searchParams.get("q") ?? "";
      const users = this.socialState.searchResultsByQuery[q] ?? [];
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          users,
        }),
      });
    }

    if (url.pathname === "/api/verify" && method === "GET") {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          valid: true,
          user: {
            username: this.socialState.currentUser,
          },
        }),
      });
    }

    if (url.pathname.startsWith("/api/friends/request/") && method === "POST") {
      const targetUser = decodeURIComponent(url.pathname.split("/").pop());
      const status = this.socialState.requestStatuses[targetUser] ?? "success";

      if (status === "already") {
        return route.fulfill({
          status: 409,
          contentType: "application/json",
          body: JSON.stringify({
            success: false,
            error: "Already friends",
          }),
        });
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
        }),
      });
    }

    if (url.pathname.startsWith("/api/friends/accept/") && method === "POST") {
      const sender = decodeURIComponent(url.pathname.split("/").pop());
      const me = this.socialState.currentUser;
      const profile = this.socialState.profiles[me] ?? buildProfile(me);

      profile.friendRequests = (profile.friendRequests ?? []).filter(
        (u) => u !== sender
      );

      if (!profile.friends.includes(sender)) {
        profile.friends.push(sender);
      }

      this.socialState.profiles[me] = profile;

      if (!this.socialState.profiles[sender]) {
        this.socialState.profiles[sender] = buildProfile(sender);
      }

      if (!this.socialState.profiles[sender].friends.includes(me)) {
        this.socialState.profiles[sender].friends.push(me);
      }

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
        }),
      });
    }

    if (url.pathname.startsWith("/api/profile/") && method === "GET") {
      const username = decodeURIComponent(url.pathname.split("/").pop());
      const profile =
        this.socialState.profiles[username] ?? buildProfile(username);

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          profile,
        }),
      });
    }

    if (url.pathname.startsWith("/api/profile/") && method === "PATCH") {
      const username = decodeURIComponent(url.pathname.split("/").pop());
      const body = request.postDataJSON ? request.postDataJSON() : {};
      const existing =
        this.socialState.profiles[username] ?? buildProfile(username);

      this.socialState.profiles[username] = {
        ...existing,
        ...body,
        location: {
          city: body.city ?? existing.location?.city ?? "",
          country: body.country ?? existing.location?.country ?? "",
        },
      };

      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
        }),
      });
    }

    // Importante: no dejes que otras llamadas /api salgan al backend real en CI
    return route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        success: false,
        error: `Unhandled mocked endpoint: ${method} ${url.pathname}`,
      }),
    });
  });
});

Given('I am logged in as {string}', async function (username) {
  this.socialState.currentUser = username;

  if (!this.socialState.profiles[username]) {
    this.socialState.profiles[username] = buildProfile(username);
  }

  await this.page.addInitScript((user) => {
    window.localStorage.setItem("username", user);
    window.localStorage.setItem("token", "fake-jwt-token");
  }, username);
});

Given("the social search for {string} returns these users:", function (query, table) {
  const rows = table.hashes().map((row) => ({
    username: row.username,
    realName: row.realName || null,
    email: row.email || null,
  }));

  this.socialState.searchResultsByQuery[query] = rows;

  for (const user of rows) {
    if (!this.socialState.profiles[user.username]) {
      this.socialState.profiles[user.username] = buildProfile(user.username, {
        realName: user.realName,
      });
    }
  }
});

Given("sending a friend request to {string} succeeds", function (username) {
  this.socialState.requestStatuses[username] = "success";
});

Given("sending a friend request to {string} says they are already friends", function (username) {
  this.socialState.requestStatuses[username] = "already";
});

Given("my profile has these pending friend requests:", function (table) {
  const rows = table.hashes();
  const me = this.socialState.currentUser;

  if (!this.socialState.profiles[me]) {
    this.socialState.profiles[me] = buildProfile(me);
  }

  this.socialState.profiles[me].friendRequests = rows
    .map((row) => row.username)
    .filter(Boolean);

  for (const username of this.socialState.profiles[me].friendRequests) {
    if (!this.socialState.profiles[username]) {
      this.socialState.profiles[username] = buildProfile(username);
    }
  }
});

Given("my profile has these friends:", function (table) {
  const rows = table.hashes();
  const me = this.socialState.currentUser;

  if (!this.socialState.profiles[me]) {
    this.socialState.profiles[me] = buildProfile(me);
  }

  this.socialState.profiles[me].friends = rows
    .map((row) => row.username)
    .filter(Boolean);

  for (const friend of this.socialState.profiles[me].friends) {
    if (!this.socialState.profiles[friend]) {
      this.socialState.profiles[friend] = buildProfile(friend);
    }
    if (!this.socialState.profiles[friend].friends.includes(me)) {
      this.socialState.profiles[friend].friends.push(me);
    }
  }
});

Given("the profile for {string} exists", function (username) {
  if (!this.socialState.profiles[username]) {
    this.socialState.profiles[username] = buildProfile(username);
  }
});

When("I go to the social page", async function () {
  await this.page.goto("http://localhost:5173/social");
  await this.page.waitForLoadState("networkidle");
});

When("I search for {string} in social", async function (query) {
  const input = this.page.locator('input[placeholder], input[type="text"]').first();
  await input.waitFor({ state: "visible", timeout: 15000 });
  await input.fill(query);

  await this.page.waitForResponse((r) => {
    const url = new URL(r.url());
    return (
      url.pathname === "/api/search" &&
      url.searchParams.get("q") === query &&
      r.request().method() === "GET"
    );
  });
});

When("I send a friend request to {string} from social", async function (username) {
  const card = this.page.locator("div").filter({ hasText: username }).first();
  await card.waitFor({ state: "visible", timeout: 15000 });

  const sendButton = card.getByRole("button", { name: /send|enviar/i }).first();
  await sendButton.waitFor({ state: "visible", timeout: 15000 });

  const [response] = await Promise.all([
    this.page.waitForResponse((r) =>
      r.url().includes(`/api/friends/request/${encodeURIComponent(username)}`) &&
      r.request().method() === "POST"
    ),
    sendButton.click(),
  ]);

  this.lastFriendRequestResponseStatus = response.status();
});

When("I accept the friend request from {string}", async function (username) {
  const requestsCard = this.page.locator(".card").filter({
    has: this.page.getByText(/friend requests|solicitudes/i),
  }).first();

  await requestsCard.waitFor({ state: "visible", timeout: 15000 });

  const row = requestsCard.locator("div").filter({
    has: this.page.getByText(username, { exact: true }),
  }).first();

  await row.waitFor({ state: "visible", timeout: 15000 });

  const currentUser = this.socialState.currentUser;

  await Promise.all([
    this.page.waitForResponse((r) =>
      r.url().includes(`/api/friends/accept/${encodeURIComponent(username)}`) &&
      r.request().method() === "POST"
    ),
    this.page.waitForResponse((r) =>
      r.url().includes(`/api/profile/${encodeURIComponent(currentUser)}`) &&
      r.request().method() === "GET"
    ),
    row.getByRole("button", { name: /accept|aceptar/i }).click(),
  ]);
});

When("I open the profile of friend {string}", async function (username) {
  const friendsCard = this.page.locator(".card").filter({
    has: this.page.getByText(/friends|amigos/i),
  }).first();

  await friendsCard.waitFor({ state: "visible", timeout: 15000 });

  const row = friendsCard.locator("div").filter({
    has: this.page.getByText(username, { exact: true }),
  }).first();

  await row.waitFor({ state: "visible", timeout: 15000 });

  await Promise.all([
    this.page.waitForURL(new RegExp(`/profile/${username}$`)),
    row.getByRole("button", { name: /view profile|ver perfil/i }).click(),
  ]);
});

Then("I should see {string} in the social results", async function (username) {
  const result = this.page.getByText(username, { exact: true });
  await result.waitFor({ state: "visible", timeout: 15000 });
  const visible = await result.isVisible();
  assert.equal(visible, true);
});

Then("I should see the friend request as sent for {string} in social", async function (_username) {
  assert.equal(this.lastFriendRequestResponseStatus, 200);
});

Then("{string} should appear in my friend list", async function (username) {
  const friendsCard = this.page.locator(".card").filter({
    has: this.page.getByText(/friends|amigos/i),
  }).first();

  await friendsCard.waitFor({ state: "visible", timeout: 15000 });

  const friend = friendsCard.getByText(username, { exact: true });
  await friend.waitFor({ state: "visible", timeout: 15000 });

  const visible = await friend.isVisible();
  assert.equal(visible, true);
});

Then("I should see {string} in my friend list", async function (username) {
  const friendsCard = this.page.locator(".card").filter({
    has: this.page.getByText(/friends|amigos/i),
  }).first();

  await friendsCard.waitFor({ state: "visible", timeout: 15000 });

  const friend = friendsCard.getByText(username, { exact: true });
  await friend.waitFor({ state: "visible", timeout: 15000 });

  const visible = await friend.isVisible();
  assert.equal(visible, true);
});

Then("I should be on the profile page of {string}", async function (username) {
  await this.page.waitForURL(new RegExp(`/profile/${username}$`), { timeout: 15000 });
  assert.match(this.page.url(), new RegExp(`/profile/${username}$`));

  const visibleUserText = this.page.getByText(username, { exact: true });
  await visibleUserText.waitFor({ state: "visible", timeout: 15000 });

  const visible = await visibleUserText.isVisible();
  assert.equal(visible, true);
});