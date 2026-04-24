/**
 * Load Test – Scenario 1: User Registration
 *
 * Simulates 50 concurrent users registering new accounts against
 * the gateway endpoint POST /register.
 *
 * Run:
 *   k6 run tests/load/register.js
 */

import http from "k6/http";
import { check, sleep } from "k6";
import { Trend, Rate } from "k6/metrics";

// ── Custom metrics ────────────────────────────────────────────────────────────
// Trend: collects timing samples (min, max, avg, p90, p95)
// Rate:  collects pass/fail ratio
const registerDuration = new Trend("register_duration", true);
const registerSuccess  = new Rate("register_success");

// ── Test configuration ────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    registration_load: {
      executor: "ramping-vus",   // ramps up virtual users gradually
      startVUs: 0,
      stages: [
        { duration: "10s", target: 50 }, // ramp up to 50 VUs in 10 s
        { duration: "30s", target: 50 }, // hold 50 VUs for 30 s
        { duration: "10s", target: 0  }, // ramp down
      ],
    },
  },
  // Test passes only if these thresholds are met
  thresholds: {
    register_duration: ["p(95)<2000"], // 95% of requests finish under 2 s
    register_success:  ["rate>0.95"],  // at least 95% of requests succeed
    http_req_failed:   ["rate<0.05"],  // fewer than 5% HTTP errors
  },
};

// ── Base URL ──────────────────────────────────────────────────────────────────
// Override with: k6 run -e BASE_URL=http://your-server register.js
const BASE_URL = __ENV.BASE_URL || "http://localhost:8080";

// ── Main test function (runs once per VU per iteration) ───────────────────────
export default function () { //NOSONAR
  // Each VU generates a unique username using its id + a timestamp
  const uniqueSuffix = `${__VU}_${Date.now()}`;
  const payload = JSON.stringify({
    username:       `loaduser_${uniqueSuffix}`,
    email:          `loaduser_${uniqueSuffix}@test.com`,
    password:       "LoadTest1234!", //NOSONAR
    repeatPassword: "LoadTest1234!", //NOSONAR
  });

  const params = {
    headers: { "Content-Type": "application/json" },
    tags:    { name: "register" }, // groups this request in the report
  };

  const res = http.post(`${BASE_URL}/register`, payload, params);

  // Record custom metrics
  registerDuration.add(res.timings.duration);
  const ok = res.status === 201 || res.status === 200;
  registerSuccess.add(ok);

  // Assertions – logged as pass/fail in the k6 summary
  check(res, {
    "status is 2xx":          (r) => r.status >= 200 && r.status < 300,
    "response has no error":  (r) => {
      try { return !JSON.parse(r.body).error; } catch { return false; }
    },
  });

  sleep(1); // 1-second pause between iterations per VU (realistic pacing)
}
