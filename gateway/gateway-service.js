import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;

app.use(express.json());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));


const USERS_BASE_URL = process.env.USERS_BASE_URL || "http://localhost:3000";
const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://localhost:4000";

const PVB_MOVE_ROUTES = {
  random_bot: `${GAMEY_BASE_URL}/v1/game/pvb/random_bot`,
  smart_bot: `${GAMEY_BASE_URL}/v1/game/pvb/smart_bot`,
};

const BOT_CHOOSE_ROUTES = {
  random_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/random_bot`,
  smart_bot: `${GAMEY_BASE_URL}/v1/ybot/choose/smart_bot`,
};

const CREATE_USER_URL = `${USERS_BASE_URL}/createuser`;
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
    return res.status(200).json({ ok: true, yen: response.data });
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

app.post("/createuser", async (req, res) => {
  try {
    const { username } = req.body;

    const patchedBody = {
      username,
      email: `${username}@fake.com`,
    };

    const response = await axios.post(CREATE_USER_URL, patchedBody);
    return res.status(response.status).json(response.data);
  } catch (error) {
    if (error.response) return res.status(error.response.status).json(error.response.data);
    return res.status(500).json({ error: "User service unavailable" });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
  });
}

export default app;
