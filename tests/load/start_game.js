/**
 * Load Test – Scenario 3: Start Bot Game
 *
 * Simulates 20 concurrent users starting a new bot game against
 * the gateway endpoint POST /game/new.
 *
 * Run:
 *   k6 run tests/load/start_game.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const gameDuration = new Trend("start_game_duration", true);
const gameSuccess  = new Rate("start_game_success");

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    start_game_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 20 }, // ramp up to 20 VUs
        { duration: "30s", target: 20 }, // hold
        { duration: "10s", target: 0  }, // ramp down
      ],
    },
  },
  thresholds: {
    start_game_duration: ["p(95)<3000"], // game engine may be slower
    start_game_success:  ["rate>0.90"],  // 90%: game service is less critical
    http_req_failed:     ["rate<0.10"],
  },
};

// ── Base URL ──────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// ── setup: create a user and log in to obtain a JWT ──────────────────────────
export function setup() {
  const headers = { "Content-Type": "application/json" };

  // Register a test user (ignore error if already exists)
  http.post(
      `${BASE_URL}/register`,
      JSON.stringify({
        username:       "game_load_user",
        email:          "game_load_user@test.com",
        password:       "GameTest1234!", //NOSONAR
        repeatPassword: "GameTest1234!", //NOSONAR
      }),
    { headers }
  );

  // Log in and get the token
  const loginRes = http.post(
    `${BASE_URL}/login`,
    JSON.stringify({ username: "game_load_user", password: "GameTest1234!" }), //NOSONAR
    { headers }
  );

  let token = null;
  try {
    token = JSON.parse(loginRes.body).token ?? null;
  } catch {
    // If login fails the VUs will run without a token; the test will still
    // measure availability of the /game/new endpoint.
  }

  return { token };
}

// ── Main test function ────────────────────────────────────────────────────────
export default function (data) { //NOSONAR
  const headers = { "Content-Type": "application/json" };
  if (data.token) {
    headers["Authorization"] = `Bearer ${data.token}`;
  }

  // POST /game/new – body is empty; the game engine initialises a fresh board
  const res = http.post(`${BASE_URL}/game/new`, JSON.stringify({ size: 7 }), {
    headers,
    tags: { name: "start_game" },
  });

  gameDuration.add(res.timings.duration);
  const ok = res.status === 200 || res.status === 201;
  gameSuccess.add(ok);

  check(res, {
    "status is 2xx":   (r) => r.status >= 200 && r.status < 300,
    "yen is returned": (r) => {
      try { return !!JSON.parse(r.body).yen; } catch { return false; }
    },
  });

  sleep(1);
}
