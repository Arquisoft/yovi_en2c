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

Before(async function () {
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

    // Search users
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

    // Send friend request
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

    // Accept friend request
    if (url.pathname.startsWith("/api/friends/accept/") && method === "POST") {
      const sender = decodeURIComponent(url.pathname.split("/").pop());
      const me = this.socialState.currentUser;
      const profile = this.socialState.profiles[me];

      profile.friendRequests = (profile.friendRequests ?? []).filter(
        (u) => u !== sender
      );

      if (!profile.friends.includes(sender)) {
        profile.friends.push(sender);
      }

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

    // Read profile
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

    // Update profile if ever needed by the page
    if (url.pathname.startsWith("/api/profile/") && method === "PATCH") {
      const username = decodeURIComponent(url.pathname.split("/").pop());
      const body = request.postDataJSON?.() ?? {};
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

    return route.continue();
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
  await this.page.goto("/social");
});

When("I search for {string} in social", async function (query) {
  const input = this.page.locator('input[placeholder], input[type="text"]').first();
  await input.fill(query);

  await this.page.waitForTimeout(500);
});

When("I send a friend request to {string} from social", async function (username) {
  const card = this.page.locator("div").filter({ hasText: username }).first();
  const sendButton = card.getByRole("button").nth(1);
  await sendButton.click();
});

When("I go to my profile page", async function () {
  const me = this.socialState.currentUser;
  await this.page.goto(`/profile/${me}`);
});

When("I accept the friend request from {string}", async function (username) {
  const row = this.page.locator("div").filter({ hasText: username }).first();
  await row.getByRole("button").click();
});

When("I open the profile of friend {string}", async function (username) {
  const row = this.page.locator("div").filter({ hasText: username }).first();
  await row.getByRole("button").click();
});

Then("I should see {string} in the social results", async function (username) {
  await expect(this.page.getByText(username, { exact: true })).toBeVisible();
});

Then("I should see the friend request as sent for {string} in social", async function (username) {
  const row = this.page.locator("div").filter({ hasText: username }).first();
  await expect(row).toContainText(/sent|request sent|already friends/i);
});

Then("{string} should appear in my friend list", async function (username) {
  await expect(this.page.getByText(username, { exact: true })).toBeVisible();
});

Then("I should see {string} in my friend list", async function (username) {
  await expect(this.page.getByText(username, { exact: true })).toBeVisible();
});

Then("I should be on the profile page of {string}", async function (username) {
  await expect(this.page).toHaveURL(new RegExp(`/profile/${username}$`));
  await expect(this.page.getByText(username, { exact: true })).toBeVisible();
});