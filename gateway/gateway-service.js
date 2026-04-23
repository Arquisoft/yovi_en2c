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
  methods: ["GET", "POST", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  normalizePath: [
    ['^/stats/.*',   '/stats/:username'],
    ['^/profile/.*', '/profile/:username'],
  ],
});
app.use(metricsMiddleware);

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000" || "http://localhost:4000"; //NOSONAR
const AUTH_BASE_URL  = process.env.AUTH_BASE_URL  || "http://authentication:5000" || "http://localhost:5000"; //NOSONAR
const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://users:3000" || "http://localhost:3000"; //NOSONAR
const MULTIPLAYER_BASE_URL = process.env.MULTIPLAYER_BASE_URL || "http://multiplayer:7000" || "http://localhost:7000"; // NOSONAR

const AUTH_REGISTER_URL = `${AUTH_BASE_URL}/register`;
const AUTH_LOGIN_URL    = `${AUTH_BASE_URL}/login`;
const AUTH_VERIFY_URL   = `${AUTH_BASE_URL}/verify`;
const GAME_RESULT_URL   = `${USERS_BASE_URL}/gameresult`;
const MULTIPLAYER_HEALTH_URL = `${MULTIPLAYER_BASE_URL}/health`;

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

// Validates that a username only contains safe characters.
// Prevents path traversal (S7044) and SSRF (S5144) by rejecting
// any value that could manipulate the upstream URL structure.
const USERNAME_RE = /^[a-zA-Z0-9_-]{1,60}$/;

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_RE.test(username);
}

// Sanitizes the Authorization header before forwarding it to upstream services.
// Extracts only the token value after "Bearer " and reconstructs the header,
// breaking the direct taint flow from req.headers that Sonar tracks as SSRF (S5144).
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

// POST /hint
// Always uses alfa_beta_bot to compute the suggestion, regardless of the bot
// the player is currently facing. This ensures hints are always high quality.
const HINT_BOT_ID = "alfa_beta_bot";

app.post("/hint", async (req, res) => {
  const { yen } = req.body;

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });

  const route = BOT_CHOOSE_ROUTES[HINT_BOT_ID];
  if (!route) return res.status(400).json({ ok: false, error: "Hint bot unavailable" });

  try {
    const response = await axios.post(route, yen); // NOSONAR
    const coords   = response.data?.coords ?? response.data;
    return res.status(200).json({ ok: true, coords });
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
    const response = await axios.get(usersUrl, {
      headers: { Authorization: authStats },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

// GET /profile/:username — public, no JWT required
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

// PATCH /profile/:username — JWT required, only owner can edit
app.patch("/profile/:username", async (req, res) => {
  const { username } = req.params;

  if (!isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: "Invalid username" });
  }

  const usersUrl   = new URL(`/profile/${username}`, USERS_BASE_URL).toString();
  const authPatch  = sanitizeAuthHeader(req.headers.authorization);

  // Extract only the known editable fields to prevent mass assignment (S5144)
  const { realName, bio, city, country, preferredLanguage } = req.body ?? {};
  const safeBody = { realName, bio, city, country, preferredLanguage };

  try {
    const response = await axios.patch(usersUrl, safeBody, {
      headers: { Authorization: authPatch },
    });
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
    const response = await axios.get(AUTH_VERIFY_URL, {
      headers: { Authorization: authVerify },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

app.get("/multiplayer/health", async (_req, res) => {
  try {
    const response = await axios.get(MULTIPLAYER_HEALTH_URL);
    return res.status(200).json({ ok: true, service: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.get("/multiplayer/rooms/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();

  if (!code) {
    return res.status(400).json({ ok: false, error: "Missing room code" });
  }

  try {
    const response = await axios.get(`${MULTIPLAYER_BASE_URL}/rooms/${encodeURIComponent(code)}`);
    return res.status(200).json({ ok: true, room: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/create", async (req, res) => {
  const { username, size } = req.body ?? {};

  if (!username || typeof username !== "string") {
    return res.status(400).json({ ok: false, error: "Missing username" });
  }

  if (!Number.isInteger(size) || size < 1) {
    return res.status(400).json({ ok: false, error: "Invalid board size" });
  }

  try {
    const response = await axios.post(`${MULTIPLAYER_BASE_URL}/rooms/create`, {
      username,
      size,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/join", async (req, res) => {
  const { code, username } = req.body ?? {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Missing room code" });
  }

  if (!username || typeof username !== "string") {
    return res.status(400).json({ ok: false, error: "Missing username" });
  }

  try {
    const response = await axios.post(`${MULTIPLAYER_BASE_URL}/rooms/join`, {
      code: code.trim().toUpperCase(),
      username,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/state", async (req, res) => {
  const { code, username } = req.body ?? {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Missing room code" });
  }

  try {
    const response = await axios.post(`${MULTIPLAYER_BASE_URL}/rooms/state`, {
      code: code.trim().toUpperCase(),
      username: typeof username === "string" ? username : undefined,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/move", async (req, res) => {
  const { code, row, col, username } = req.body ?? {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Missing room code" });
  }

  if (typeof row !== "number" || typeof col !== "number") {
    return res.status(400).json({ ok: false, error: "Missing row/col" });
  }

  if (!username || typeof username !== "string") {
    return res.status(400).json({ ok: false, error: "Missing username" });
  }

  try {
    const response = await axios.post(`${MULTIPLAYER_BASE_URL}/rooms/move`, {
      code: code.trim().toUpperCase(),
      row,
      col,
      username,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/leave", async (req, res) => {
  const { code, username } = req.body ?? {};

  if (!code || typeof code !== "string") {
    return res.status(400).json({ ok: false, error: "Missing room code" });
  }

  if (!username || typeof username !== "string") {
    return res.status(400).json({ ok: false, error: "Missing username" });
  }

  try {
    const response = await axios.post(`${MULTIPLAYER_BASE_URL}/rooms/leave`, {
      code: code.trim().toUpperCase(),
      username,
    });
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
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