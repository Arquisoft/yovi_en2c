import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

const GAMEY_BASE_URL = "http://gamey:4000";
const AUTH_BASE_URL = "http://authentication:5000";
const AUTH_REGISTER_URL = `${AUTH_BASE_URL}/register`;
const AUTH_LOGIN_URL = `${AUTH_BASE_URL}/login`;
const AUTH_VERIFY_URL = `${AUTH_BASE_URL}/verify`;

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

app.get("/game/status", async (req, res) => {
  try {
    const response = await axios.get(GAME_STATUS_URL);
    return res.status(200).json({
      ok: true,
      message: response.data,
    });
  } catch (error) {
    return forwardAxiosError(res, error, "Game server unavailable");
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
      headers: {
        Authorization: req.headers.authorization,
      },
    });

    return res.status(response.status).json(response.data);
  } catch (error) {
    return forwardAxiosError(res, error, "Auth service unavailable");
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
  });
}

export default app;