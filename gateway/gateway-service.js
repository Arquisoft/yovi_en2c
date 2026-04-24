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
    ["^/stats/.*", "/stats/:username"],
    ["^/profile/.*", "/profile/:username"],
    ["^/friends/request/.*", "/friends/request/:username"],
    ["^/friends/accept/.*", "/friends/accept/:username"],
    ["^/friends/.*", "/friends/:username"],
    ["^/notifications/.*/read", "/notifications/:id/read"],
  ],
});
app.use(metricsMiddleware);

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || /*"http://gamey:4000" ||*/ "http://localhost:4000"; //NOSONAR
const AUTH_BASE_URL  = process.env.AUTH_BASE_URL  || /*"http://authentication:5000" ||*/ "http://localhost:5000"; //NOSONAR
const USERS_BASE_URL = process.env.USERS_BASE_URL || /*"http://users:3000" ||*/ "http://localhost:3000"; //NOSONAR
const MULTIPLAYER_BASE_URL = process.env.MULTIPLAYER_BASE_URL || /*"http://multiplayer:7000" ||*/ "http://localhost:7000"; // NOSONAR

const AUTH_REGISTER_URL = `${AUTH_BASE_URL}/register`;
const AUTH_LOGIN_URL = `${AUTH_BASE_URL}/login`;
const AUTH_VERIFY_URL = `${AUTH_BASE_URL}/verify`;
const GAME_RESULT_URL = `${USERS_BASE_URL}/gameresult`;
const MULTIPLAYER_HEALTH_URL = `${MULTIPLAYER_BASE_URL}/health`;
const MULTIPLAYER_GAME_RESULT_URL = `${USERS_BASE_URL}/gameresult/multiplayer`;

const PVB_MOVE_ROUTES = {
  random_bot: `${GAMEY_BASE_URL}/v1/game/pvb/random_bot`,
  heuristic_bot: `${GAMEY_BASE_URL}/v1/game/pvb/heuristic_bot`,
  minimax_bot: `${GAMEY_BASE_URL}/v1/game/pvb/minimax_bot`,
  alfa_beta_bot: `${GAMEY_BASE_URL}/v1/game/pvb/alfa_beta_bot`,
  monte_carlo_hard: `${GAMEY_BASE_URL}/v1/game/pvb/monte_carlo_hard`,
  monte_carlo_extreme: `${GAMEY_BASE_URL}/v1/game/pvb/monte_carlo_extreme`,
};

const BOT_CHOOSE_ROUTES = {
  random_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/random_bot`,
  heuristic_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/heuristic_bot`,
  minimax_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/minimax_bot`,
  alfa_beta_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/alfa_beta_bot`,
  monte_carlo_hard: `${GAMEY_BASE_URL}/v1/ybot/choose/monte_carlo_hard`,
  monte_carlo_extreme: `${GAMEY_BASE_URL}/v1/ybot/choose/monte_carlo_extreme`,
};

const GAME_NEW_URL = `${GAMEY_BASE_URL}/game/new`;
const GAME_STATUS_URL = `${GAMEY_BASE_URL}/status`;

const USERNAME_RE = /^[a-zA-Z0-9_-]{1,60}$/;
const ROOM_CODE_RE = /^[A-Z0-9]{1,12}$/;
const OBJECT_ID_RE = /^[a-f\d]{24}$/i;
const BEARER_RE = /^Bearer\s+([A-Za-z0-9\-._~+/]+=*)$/;

function isValidUsername(username) {
  return typeof username === "string" && USERNAME_RE.test(username);
}

function isValidRoomCode(code) {
  return typeof code === "string" && ROOM_CODE_RE.test(code);
}

function isValidObjectId(id) {
  return typeof id === "string" && OBJECT_ID_RE.test(id);
}

function safePathSegment(value, validator) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!validator(trimmed)) return null;

  return encodeURIComponent(trimmed);
}

function safeUsernameSegment(username) {
  return safePathSegment(username, isValidUsername);
}

function safeObjectIdSegment(id) {
  return safePathSegment(id, isValidObjectId);
}

function safeRoomCodeSegment(code) {
  return safePathSegment(code, isValidRoomCode);
}

function internalUrl(baseUrl, path) {
  return new URL(path, baseUrl).toString();
}

function sanitizeAuthHeader(authHeader) {
  if (!authHeader || typeof authHeader !== "string") return undefined;

  const match = BEARER_RE.exec(authHeader);
  if (!match) return undefined;

  return `Bearer ${match[1]}`;
}

function forwardAxiosError(res, error, fallbackMessage) {
  const status = error?.response?.status;
  const data = error?.response?.data;

  if (status) {
    return res.status(status).json({
      ok: false,
      error: typeof data === "string" ? data : data?.error ?? data?.message ?? fallbackMessage,
      details: data,
    });
  }

  return res.status(502).json({ ok: false, error: fallbackMessage });
}

function requireString(value, errorMessage) {
  return typeof value === "string" && value.trim() ? null : errorMessage;
}

function requirePositiveInt(value, errorMessage) {
  return Number.isInteger(value) && value > 0 ? null : errorMessage;
}

function requireNumber(value, errorMessage) {
  return typeof value === "number" && Number.isFinite(value) ? null : errorMessage;
}

function normalizeRoomCode(code) {
  return String(code || "").trim().toUpperCase();
}

function validateMultiplayerFields(validations) {
  for (const validation of validations) {
    if (validation) return validation;
  }
  return null;
}

function validateUsernameParam(res, username) {
  if (!isValidUsername(username)) {
    res.status(400).json({ ok: false, error: "Invalid username" });
    return false;
  }

  return true;
}

function requireAuth(res, auth) {
  if (!auth) {
    res.status(401).json({ ok: false, error: "Authorization header required" });
    return false;
  }

  return true;
}

async function proxyMultiplayerPost(res, path, payload, fallbackMessage) {
  try {
    const response = await axios.post(internalUrl(MULTIPLAYER_BASE_URL, path), payload); //NOSONAR
    return res.status(200).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, fallbackMessage);
  }
}

/**
 * Proxies an authenticated GET request to the users service.
 * Extracts and validates the Authorization header, then forwards the request.
 */
async function proxyUsersGet(res, usersUrl, authHeader) {
  const auth = sanitizeAuthHeader(authHeader);
  if (!requireAuth(res, auth)) return;

  try {
    const response = await axios.get(usersUrl, {
      headers: { Authorization: auth },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
}

/**
 * Proxies an authenticated POST (with empty body) to the users service.
 * Used for friend request/accept actions.
 */
async function proxyUsersPostWithAuth(res, usersUrl, authHeader) {
  const auth = sanitizeAuthHeader(authHeader);
  if (!requireAuth(res, auth)) return;

  try {
    const response = await axios.post(usersUrl, {}, { //NOSONAR
      headers: { Authorization: auth }, //NOSONAR
    }); //NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
}

app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(GAME_NEW_URL, req.body); //NOSONAR
    return res.status(200).json({ ok: true, yen: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot, row, col } = req.body ?? {};

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });

  if (typeof row !== "number" || typeof col !== "number") {
    return res.status(400).json({ ok: false, error: "Missing row/col" });
  }

  const route = PVB_MOVE_ROUTES[bot];
  if (!route) return res.status(400).json({ ok: false, error: "Invalid bot id" });

  try {
    const response = await axios.post(route, { yen, row, col }); //NOSONAR
    const payload = response.data || {};

    return res.status(200).json({
      ok: true,
      yen: payload.yen ?? payload,
      finished: payload.finished === true,
      winner: payload.winner ?? null,
      winning_edges: payload.winning_edges ?? [],
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/game/bot/choose", async (req, res) => {
  const { yen, bot } = req.body ?? {};

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });

  const route = BOT_CHOOSE_ROUTES[bot];
  if (!route) return res.status(400).json({ ok: false, error: "Invalid bot id" });

  try {
    const response = await axios.post(route, yen); //NOSONAR
    return res.status(200).json({ ok: true, coordinates: response.data.coords });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

const HINT_BOT_ID = "alfa_beta_bot";

app.post("/hint", async (req, res) => {
  const { yen } = req.body ?? {};

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });

  const route = BOT_CHOOSE_ROUTES[HINT_BOT_ID];
  if (!route) return res.status(400).json({ ok: false, error: "Hint bot unavailable" });

  try {
    const response = await axios.post(route, yen); //NOSONAR
    return res.status(200).json({ ok: true, coords: response.data?.coords ?? response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.get("/game/status", async (_req, res) => {
  try {
    const response = await axios.get(GAME_STATUS_URL);
    return res.status(200).json({ ok: true, message: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
  }
});

app.post("/gameresult", async (req, res) => {
  try {
    const response = await axios.post(GAME_RESULT_URL, req.body); //NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.post("/gameresult/multiplayer", async (req, res) => {
  try {
    const response = await axios.post(MULTIPLAYER_GAME_RESULT_URL, req.body); //NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/stats/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/stats/${safeUsername}`);

  return proxyUsersGet(res, usersUrl, req.headers.authorization);
});

app.get("/profile/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/profile/${safeUsername}`);

  try {
    const response = await axios.get(usersUrl);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.patch("/profile/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/profile/${safeUsername}`);
  const authPatch = sanitizeAuthHeader(req.headers.authorization);
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

app.post("/friends/request/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/friends/request/${safeUsername}`);

  return proxyUsersPostWithAuth(res, usersUrl, req.headers.authorization);
});

app.post("/friends/accept/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/friends/accept/${safeUsername}`);

  return proxyUsersPostWithAuth(res, usersUrl, req.headers.authorization);
});

app.delete("/friends/:username", async (req, res) => {
  const { username } = req.params;
  if (!validateUsernameParam(res, username)) return;

  const auth = sanitizeAuthHeader(req.headers.authorization);
  if (!requireAuth(res, auth)) return;

  const safeUsername = safeUsernameSegment(username);
  const usersUrl = internalUrl(USERS_BASE_URL, `/friends/${safeUsername}`);

  try {
    const response = await axios.delete(usersUrl, {
      headers: { Authorization: auth },
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/friends", async (req, res) => {
  const usersUrl = internalUrl(USERS_BASE_URL, "/friends");
  return proxyUsersGet(res, usersUrl, req.headers.authorization);
});

app.get("/notifications", async (req, res) => {
  const usersUrl = internalUrl(USERS_BASE_URL, "/notifications");
  return proxyUsersGet(res, usersUrl, req.headers.authorization);
});

app.patch("/notifications/:id/read", async (req, res) => {
  const { id } = req.params;

  if (!isValidObjectId(id)) {
    return res.status(400).json({ ok: false, error: "Invalid notification id" });
  }

  const auth = sanitizeAuthHeader(req.headers.authorization);
  if (!requireAuth(res, auth)) return;

  const safeId = safeObjectIdSegment(id);
  const usersUrl = internalUrl(USERS_BASE_URL, `/notifications/${safeId}/read`);

  try {
    const response = await axios.patch(usersUrl, {}, {
      headers: { Authorization: auth },
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(AUTH_LOGIN_URL, req.body); //NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

app.post("/register", async (req, res) => {
  try {
    const response = await axios.post(AUTH_REGISTER_URL, req.body); //NOSONAR
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
  const code = normalizeRoomCode(req.params.code);

  const validationError = validateMultiplayerFields([
    requireString(code, "Missing room code"),
  ]);

  if (validationError || !isValidRoomCode(code)) {
    return res.status(400).json({ ok: false, error: validationError || "Invalid room code" });
  }

  const safeCode = safeRoomCodeSegment(code);
  const roomUrl = internalUrl(MULTIPLAYER_BASE_URL, `/rooms/${safeCode}`);

  try {
    const response = await axios.get(roomUrl);
    return res.status(200).json({ ok: true, room: response.data });
  } catch (error) {
    return forwardAxiosError(res, error, "Multiplayer service unavailable");
  }
});

app.post("/multiplayer/room/create", async (req, res) => {
  const { username, size } = req.body ?? {};

  const validationError = validateMultiplayerFields([
    requireString(username, "Missing username"),
    requirePositiveInt(size, "Invalid board size"),
  ]);

  if (validationError || !isValidUsername(username)) {
    return res.status(400).json({ ok: false, error: validationError || "Invalid username" });
  }

  return proxyMultiplayerPost(
    res,
    "/rooms/create",
    { username: username.trim(), size },
    "Multiplayer service unavailable"
  );
});

app.post("/multiplayer/room/join", async (req, res) => {
  const { code, username } = req.body ?? {};
  const normalizedCode = normalizeRoomCode(code);

  const validationError = validateMultiplayerFields([
    requireString(normalizedCode, "Missing room code"),
    requireString(username, "Missing username"),
  ]);

  if (validationError || !isValidRoomCode(normalizedCode) || !isValidUsername(username)) {
    return res.status(400).json({
      ok: false,
      error: validationError || "Invalid multiplayer join payload",
    });
  }

  return proxyMultiplayerPost(
    res,
    "/rooms/join",
    { code: normalizedCode, username: username.trim() },
    "Multiplayer service unavailable"
  );
});

app.post("/multiplayer/room/state", async (req, res) => {
  const { code, username } = req.body ?? {};
  const normalizedCode = normalizeRoomCode(code);

  const validationError = validateMultiplayerFields([
    requireString(normalizedCode, "Missing room code"),
  ]);

  if (validationError || !isValidRoomCode(normalizedCode)) {
    return res.status(400).json({ ok: false, error: validationError || "Invalid room code" });
  }

  const payload = {
    code: normalizedCode,
    username: typeof username === "string" && isValidUsername(username) ? username.trim() : undefined,
  };

  return proxyMultiplayerPost(
    res,
    "/rooms/state",
    payload,
    "Multiplayer service unavailable"
  );
});

app.post("/multiplayer/room/move", async (req, res) => {
  const { code, row, col, username } = req.body ?? {};
  const normalizedCode = normalizeRoomCode(code);

  const validationError = validateMultiplayerFields([
    requireString(normalizedCode, "Missing room code"),
    requireNumber(row, "Missing row/col"),
    requireNumber(col, "Missing row/col"),
    requireString(username, "Missing username"),
  ]);

  if (validationError || !isValidRoomCode(normalizedCode) || !isValidUsername(username)) {
    return res.status(400).json({
      ok: false,
      error: validationError || "Invalid multiplayer move payload",
    });
  }

  return proxyMultiplayerPost(
    res,
    "/rooms/move",
    { code: normalizedCode, row, col, username: username.trim() },
    "Multiplayer service unavailable"
  );
});

app.post("/multiplayer/room/leave", async (req, res) => {
  const { code, username } = req.body ?? {};
  const normalizedCode = normalizeRoomCode(code);

  const validationError = validateMultiplayerFields([
    requireString(normalizedCode, "Missing room code"),
    requireString(username, "Missing username"),
  ]);

  if (validationError || !isValidRoomCode(normalizedCode) || !isValidUsername(username)) {
    return res.status(400).json({
      ok: false,
      error: validationError || "Invalid multiplayer leave payload",
    });
  }

  return proxyMultiplayerPost(
    res,
    "/rooms/leave",
    { code: normalizedCode, username: username.trim() },
    "Multiplayer service unavailable"
  );
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  });
}

export default app;