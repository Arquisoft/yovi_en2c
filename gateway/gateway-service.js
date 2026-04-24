import express from "express";
import axios from "axios";
import cors from "cors";
import promBundle from "express-prom-bundle";

const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  normalizePath: [
    ['^/stats/.*',              '/stats/:username'],
    ['^/profile/.*',            '/profile/:username'],
    ['^/friends/request/.*',    '/friends/request/:username'],
    ['^/friends/accept/.*',     '/friends/accept/:username'],
    ['^/friends/.*',            '/friends/:username'],
    ['^/notifications/.*/read', '/notifications/:id/read'],
  ],
});
app.use(metricsMiddleware);

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000" || "http://localhost:4000"; //NOSONAR
const AUTH_BASE_URL  = process.env.AUTH_BASE_URL  || "http://authentication:5000" || "http://localhost:5000"; //NOSONAR
const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://users:3000" || "http://localhost:3000"; //NOSONAR

const AUTH_REGISTER_URL = `${AUTH_BASE_URL}/register`;
const AUTH_LOGIN_URL    = `${AUTH_BASE_URL}/login`;
const AUTH_VERIFY_URL   = `${AUTH_BASE_URL}/verify`;
const GAME_RESULT_URL   = `${USERS_BASE_URL}/gameresult`;

const PVB_MOVE_ROUTES = {
  random_bot:          `${GAMEY_BASE_URL}/v1/game/pvb/random_bot`,
  heuristic_bot:       `${GAMEY_BASE_URL}/v1/game/pvb/heuristic_bot`,
  minimax_bot:         `${GAMEY_BASE_URL}/v1/game/pvb/minimax_bot`,
  alfa_beta_bot:       `${GAMEY_BASE_URL}/v1/game/pvb/alfa_beta_bot`,
  monte_carlo_hard:    `${GAMEY_BASE_URL}/v1/game/pvb/monte_carlo_hard`,
  monte_carlo_extreme: `${GAMEY_BASE_URL}/v1/game/pvb/monte_carlo_extreme`,
};

const BOT_CHOOSE_ROUTES = {
  random_bot:          `${GAMEY_BASE_URL}/v1/ybot/choose/random_bot`,
  heuristic_bot:       `${GAMEY_BASE_URL}/v1/ybot/choose/heuristic_bot`,
  minimax_bot:         `${GAMEY_BASE_URL}/v1/ybot/choose/minimax_bot`,
  alfa_beta_bot:       `${GAMEY_BASE_URL}/v1/ybot/choose/alfa_beta_bot`,
  monte_carlo_hard:    `${GAMEY_BASE_URL}/v1/ybot/choose/monte_carlo_hard`,
  monte_carlo_extreme: `${GAMEY_BASE_URL}/v1/ybot/choose/monte_carlo_extreme`,
};

const GAME_NEW_URL    = `${GAMEY_BASE_URL}/game/new`;
const GAME_STATUS_URL = `${GAMEY_BASE_URL}/status`;

// ── Security helpers ──────────────────────────────────────────────────────────

const USERNAME_RE  = /^[a-zA-Z0-9_-]{1,60}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_RE.test(username);
}

function isValidObjectId(id) {
  return typeof id === "string" && OBJECT_ID_RE.test(id);
}

const BEARER_RE = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/;

function sanitizeAuthHeader(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return undefined;
  const match = BEARER_RE.exec(authHeader);
  if (!match) return undefined;
  return `Bearer ${match[1]}`;
}

// ── Error forwarding ──────────────────────────────────────────────────────────

function forwardAxiosError(res, error, fallbackMessage) {
  const status = error?.response?.status;
  const data   = error?.response?.data;

  if (status) {
    return res.status(status).json({
      ok: false,
      error: typeof data === "string" ? data : data?.error ?? data?.message ?? fallbackMessage,
      details: data,
    });
  }

  return res.status(502).json({ ok: false, error: fallbackMessage });
}

// ── Game endpoints ────────────────────────────────────────────────────────────

app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(GAME_NEW_URL, req.body); // NOSONAR
    return res.status(200).json({ ok: true, yen: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot, row, col } = req.body;
  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });
  if (typeof row !== "number" || typeof col !== "number") {
    return res.status(400).json({ ok: false, error: "Missing row/col" });
  }
  const route = PVB_MOVE_ROUTES[bot];
  if (!route) return res.status(400).json({ ok: false, error: "Invalid bot id" });

  try {
    const response = await axios.post(route, { yen, row, col }); // NOSONAR
    const payload  = response.data || {};
    return res.status(200).json({
      ok:            true,
      yen:           payload.yen ?? payload,
      finished:      payload.finished === true,
      winner:        payload.winner ?? null,
      winning_edges: payload.winning_edges ?? [],
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/bot/choose", async (req, res) => {
  const { yen, bot } = req.body;
  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });
  const route = BOT_CHOOSE_ROUTES[bot];
  if (!route) return res.status(400).json({ ok: false, error: "Invalid bot id" });

  try {
    const response = await axios.post(route, yen); // NOSONAR
    return res.status(200).json({ ok: true, coordinates: response.data.coords });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

const HINT_BOT_ID = "alfa_beta_bot";

app.post("/hint", async (req, res) => {
  const { yen } = req.body;
  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });
  const route = BOT_CHOOSE_ROUTES[HINT_BOT_ID];
  if (!route) return res.status(400).json({ ok: false, error: "Hint bot unavailable" });

  try {
    const response = await axios.post(route, yen); // NOSONAR
    return res.status(200).json({ ok: true, coords: response.data?.coords ?? response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.get("/game/status", async (req, res) => {
  try {
    const response = await axios.get(GAME_STATUS_URL);
    return res.status(200).json({ ok: true, message: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

// ── Users endpoints ───────────────────────────────────────────────────────────

app.post("/gameresult", async (req, res) => {
  try {
    const response = await axios.post(GAME_RESULT_URL, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/stats/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl  = new URL(`/stats/${username}`, USERS_BASE_URL).toString();
  const authStats = sanitizeAuthHeader(req.headers.authorization);

  try {
    const response = await axios.get(usersUrl, { headers: { Authorization: authStats } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/profile/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl = new URL(`/profile/${username}`, USERS_BASE_URL).toString();

  try {
    const response = await axios.get(usersUrl);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.patch("/profile/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl  = new URL(`/profile/${username}`, USERS_BASE_URL).toString();
  const authPatch = sanitizeAuthHeader(req.headers.authorization);
  const { realName, bio, city, country, preferredLanguage } = req.body ?? {};

  try {
    const response = await axios.patch(usersUrl, { realName, bio, city, country, preferredLanguage }, {
      headers: { Authorization: authPatch },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

// ── Search endpoint ───────────────────────────────────────────────────────────

app.get("/search", async (req, res) => {
  const { q } = req.query;
  if (!q || typeof q !== "string" || q.trim().length < 1) {
    return res.status(400).json({ ok: false, error: "Query parameter q is required" });
  }
  const usersUrl = new URL("/search", USERS_BASE_URL);
  usersUrl.searchParams.set("q", q.trim());

  try {
    const response = await axios.get(usersUrl.toString());
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

// ── Friends endpoints ─────────────────────────────────────────────────────────

app.post("/friends/request/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl = new URL(`/friends/request/${username}`, USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.post(usersUrl, {}, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.post("/friends/accept/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl = new URL(`/friends/accept/${username}`, USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.post(usersUrl, {}, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.delete("/friends/:username", async (req, res) => {
  const { username } = req.params;
  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }
  const usersUrl = new URL(`/friends/${username}`, USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.delete(usersUrl, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/friends", async (req, res) => {
  const usersUrl = new URL("/friends", USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.get(usersUrl, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

// ── Notification endpoints ────────────────────────────────────────────────────

/**
 * GET /notifications
 * Returns all notifications for the authenticated user. Requires JWT.
 */
app.get("/notifications", async (req, res) => {
  const usersUrl = new URL("/notifications", USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.get(usersUrl, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

/**
 * PATCH /notifications/:id/read
 * Marks a notification as read. Requires JWT.
 */
app.patch("/notifications/:id/read", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid notification id" });
  }

  const usersUrl = new URL(`/notifications/${id}/read`, USERS_BASE_URL).toString();
  const auth     = sanitizeAuthHeader(req.headers.authorization);
  if (!auth) return res.status(401).json({ ok: false, error: "Authorization header required" });

  try {
    const response = await axios.patch(usersUrl, {}, { headers: { Authorization: auth } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

// ── Auth endpoints ────────────────────────────────────────────────────────────

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(AUTH_LOGIN_URL, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

app.post("/register", async (req, res) => {
  try {
    const response = await axios.post(AUTH_REGISTER_URL, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

app.get("/verify", async (req, res) => {
  const authVerify = sanitizeAuthHeader(req.headers.authorization);

  try {
    const response = await axios.get(AUTH_VERIFY_URL, { headers: { Authorization: authVerify } });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

// ── Server start ──────────────────────────────────────────────────────────────

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  });
}

export default app;