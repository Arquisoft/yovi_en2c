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
    ['^/stats/.*', '/stats/:username'],
    ['^/profile/.*', '/profile/:username'],
  ],
});
app.use(metricsMiddleware);

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://gamey:4000" || "http://localhost:4000"; //NOSONAR
const AUTH_BASE_URL = process.env.AUTH_BASE_URL || "http://authentication:5000" || "http://localhost:5000"; //NOSONAR
const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://users:3000" || "http://localhost:3000"; //NOSONAR

const AUTH_REGISTER_URL = `${AUTH_BASE_URL}/register`;
const AUTH_LOGIN_URL = `${AUTH_BASE_URL}/login`;
const AUTH_VERIFY_URL = `${AUTH_BASE_URL}/verify`;
const GAME_RESULT_URL = `${USERS_BASE_URL}/gameresult`;

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
    const coords = response.data?.coords ?? response.data;
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

app.post("/gameresult", async (req, res) => {
  try {
    const response = await axios.post(GAME_RESULT_URL, req.body); // NOSONAR
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/stats/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.get(`${USERS_BASE_URL}/stats/${username}`, {
      headers: { Authorization: req.headers.authorization },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.get("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.get(`${USERS_BASE_URL}/profile/${username}`);
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

app.patch("/profile/:username", async (req, res) => {
  try {
    const { username } = req.params;
    const response = await axios.patch(
        `${USERS_BASE_URL}/profile/${username}`,
        req.body,
        { headers: { Authorization: req.headers.authorization } }
    );
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Users service unavailable");
  }
});

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
  try {
    const response = await axios.get(AUTH_VERIFY_URL, {
      headers: { Authorization: req.headers.authorization },
    });
    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    console.log(`Metrics available at http://localhost:${PORT}/metrics`);
  });
}

export default app;