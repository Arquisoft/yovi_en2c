import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;


app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "http://localhost:4173",
    "https://gameofy.publicvm.com",
    "https://gameofy.publicvm.com:8080",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
  credentials: true,
}));

const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://users:3000";
const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000";
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://authentication:5000"; //NOSONAR
const LOGIN_USER_URL = `${USERS_BASE_URL}/login`;

const CREATE_USER_URL = `${USERS_BASE_URL}/createuser`;
const GAME_NEW_URL = `${GAMEY_BASE_URL}/game/new`;
const GAME_STATUS_URL = `${GAMEY_BASE_URL}/status`;

// Bot IDs are passed through directly to the Rust server which validates them.
// No gateway-level whitelist — this avoids mismatches between gateway and registry.
function pvbMoveUrl(botId) {
  return `${GAMEY_BASE_URL}/v1/game/pvb/${botId}`;
}
function botChooseUrl(botId) {
  return `${GAMEY_BASE_URL}/v1/ybot/choose/${botId}`;
}

// Candidate IDs to probe when building the /bots discovery list.
const CANDIDATE_BOT_IDS = [
  "random_bot",
  "smart_bot",
  "heuristic_bot",
  "minimax_bot",
  "alfa_beta_bot",
  "monte_carlo_hard",
  "monte_carlo_extreme",
  "monte_carlo_bot",
];

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

  return res.status(502).json({
    ok: false,
    error: fallbackMessage,
  });
}

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
  if (!bot || typeof bot !== "string" || !CANDIDATE_BOT_IDS.includes(bot)) {
    return res.status(400).json({ ok: false, error: "Invalid bot id" });
  }

  try {
    const response = await axios.post(pvbMoveUrl(bot), { yen, row, col }); // NOSONAR
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
  const { yen, bot } = req.body;

  if (!yen) return res.status(400).json({ ok: false, error: "Missing YEN" });
  if (!bot || typeof bot !== "string" || !CANDIDATE_BOT_IDS.includes(bot)) {
    return res.status(400).json({ ok: false, error: "Invalid bot id" });
  }

  try {
    const response = await axios.post(botChooseUrl(bot), yen); // NOSONAR
    return res.status(200).json({ ok: true, coordinates: response.data.coords });
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

// Discovery endpoint: probe each candidate bot ID against the Rust server
// to find which ones are actually registered. Returns { ok: true, bots: [...] }.
app.get("/bots", async (req, res) => {
  // Use a minimal valid game to probe the choose endpoint
  let probeYen;
  try {
    const newRes = await axios.post(GAME_NEW_URL, { size: 3 });
    probeYen = newRes.data;
  } catch {
    return res.status(502).json({ ok: false, error: "Game server unavailable" });
  }

  const available = [];
  await Promise.all(
      CANDIDATE_BOT_IDS.map(async (id) => {
        try {
          await axios.post(botChooseUrl(id), probeYen);
          available.push(id);
        } catch (err) {
          // 400 "Bot not found" = not registered; any other error = treat as unavailable
          // Either way, skip it
        }
      })
  );

  return res.status(200).json({ ok: true, bots: available.sort() });
});

app.post("/createuser", async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const response = await axios.post(CREATE_USER_URL, { username, email, password }); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ error: "User service unavailable" });
  }
});

app.post("/login", async (req, res) => {
  try {
    const response = await axios.post(`${AUTH_BASE_URL}/login`, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ error: "User service unavailable" });
  }
});

app.get("/verify", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      return res.status(401).json({ success: false, error: "Missing token" });
    }

    const response = await axios.get(`${AUTH_BASE_URL}/verify`, {
      headers: {
        Authorization: authHeader,
      },
    });

    return res.status(200).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "Auth service unavailable" });
  }
});

// ── Game history endpoints (proxied to users-service) ────────────────────────

/**
 * POST /gameresult
 * Records a finished game result for a user.
 * Body: { username, opponent, result: "win"|"loss", score? }
 */
app.post("/gameresult", async (req, res) => {
  try {
    const { username, opponent, result, score } = req.body;
    const response = await axios.post(`${USERS_BASE_URL}/gameresult`, { // NOSONAR
      username,
      opponent,
      result,
      score,
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

/**
 * GET /history/:username
 * Returns the game history and stats for a user.
 * Query param: limit (default 20)
 */
app.get("/history/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const { limit } = req.query;
    const url = `${USERS_BASE_URL}/history/${encodeURIComponent(username)}${limit ? `?limit=${limit}` : ""}`;
    const response = await axios.get(url); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

/**
 * GET /ranking
 * Returns the top-10 ranking of players by wins.
 */
app.get("/ranking", async (req, res) => {
  try {
    const response = await axios.get(`${USERS_BASE_URL}/ranking`); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ success: false, error: "User service unavailable" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
  });
}
app.get("/play", async (req, res) => {
  try {
    const positionRaw = req.query.position;
    const botId = req.query.bot_id;

    if (typeof positionRaw !== "string") {
      return res.status(400).json({ error: "Missing position" });
    }

    const response = await axios.get(`${BOT_API_URL}/play`, {
      params: {
        position: positionRaw,   // already a string, no need to re-parse and re-stringify
        bot_id: botId
      }
    });

    // Pass through whatever bot-api returned: { coords } or { action }
    return res.json(response.data);

  } catch (err) {
    console.error("PLAY ERROR:", err?.response?.data || err.message);
    return res.status(500).json({
      error: "play failed",
      details: err?.response?.data || err.message
    });
  }
});

export default app;
