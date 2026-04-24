/**
 * Load Test – Scenario 2: User Login
 *
 * Simulates 50 concurrent users logging in with existing credentials
 * against the gateway endpoint POST /login.
 *
 * Prerequisites: the users below must already exist in the database.
 * Tip: run the register test first, or seed the DB with these accounts.
 *
 * Run:
 *   k6 run tests/load/login.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginDuration = new Trend("login_duration", true);
const loginSuccess  = new Rate("login_success");

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    login_load: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 },
        { duration: "30s", target: 50 },
        { duration: "10s", target: 0  },
      ],
    },
  },
  thresholds: {
    login_duration: ["p(95)<1500"], // login should be faster than register
    login_success:  ["rate>0.95"],
    http_req_failed: ["rate<0.05"],
  },
};

// ── Base URL ──────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// ── Seed users ────────────────────────────────────────────────────────────────
// These accounts must exist before running this test.
// The setup() function creates them automatically if they don't exist yet.
const SEED_USERS = Array.from({ length: 10 }, (_, i) => ({
  username: `seed_login_user_${i}`,
  password: "SeedPassword1234!", //NOSONAR
}));

// setup() runs ONCE before all VUs start – ideal for creating prerequisite data
export function setup() {
  const headers = { "Content-Type": "application/json" };

  for (const user of SEED_USERS) {
    const payload = JSON.stringify({ //NOSONAR
      username:       user.username,
      email:          `${user.username}@test.com`,
      password:       user.password,
      repeatPassword: user.password,
    });
    // 409 / 400 means the user already exists – that is fine
    http.post(`${BASE_URL}/register`, payload, { headers });
  }

  // Return seed data so the default function can use it
  return { users: SEED_USERS };
}

// ── Main test function ────────────────────────────────────────────────────────
export default function (data)  {
  // Each VU picks one of the seed users in a round-robin fashion
  const user    = data.users[__VU % data.users.length];
  const payload = JSON.stringify({ //NOSONAR
    username: user.username,
    password: user.password,
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    tags:    { name: "login" },
  };

  const res = http.post(`${BASE_URL}/login`, payload, params);

  loginDuration.add(res.timings.duration);
  const ok = res.status === 200;
  loginSuccess.add(ok);

  check(res, {
    "status is 200":       (r) => r.status === 200,
    "token is returned":   (r) => {
      try { return !!JSON.parse(r.body).token; } catch { return false; }
    },
  });

  sleep(1);
}
