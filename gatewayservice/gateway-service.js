import express from "express";
import axios from "axios";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;

app.use(express.json());

// STATIC ROUTES
const PVB_MOVE_ROUTES = {
  random_bot: "http://localhost:4000/v1/game/pvb/random_bot",
  smart_bot: "http://localhost:4000/v1/game/pvb/smart_bot"
};

const BOT_CHOOSE_ROUTES = {
  random_bot: "http://localhost:4000/v1/ybot/choose/random_bot",
  smart_bot: "http://localhost:4000/v1/ybot/choose/smart_bot"
};

const GAME_NEW_URL = "http://localhost:4000/game/new";
const CREATE_USER_URL = "http://localhost:3000/createuser";

/* ======================
   NEW GAME
====================== */
app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(GAME_NEW_URL, req.body);

    return res.status(200).json({
      ok: true,
      yen: response.data
    });

  } catch {
    return res.status(500).json({
      ok: false,
      error: "Game server unavailable"
    });
  }
});

/* ======================
   PVB MOVE
====================== */
app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot } = req.body;

  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: "Missing YEN"
    });
  }

  const route = PVB_MOVE_ROUTES[bot];

  if (!route) {
    return res.status(400).json({
      ok: false,
      error: "Invalid bot id"
    });
  }

  try {
    const response = await axios.post(route, yen);

    return res.status(200).json({
      ok: true,
      yen: response.data
    });

  } catch {
    return res.status(500).json({
      ok: false,
      error: "Game server unavailable"
    });
  }
});

/* ======================
   BOT CHOOSE
====================== */
app.post("/game/bot/choose", async (req, res) => {
  const { yen, bot } = req.body;

  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: "Missing YEN"
    });
  }

  const route = BOT_CHOOSE_ROUTES[bot];

  if (!route) {
    return res.status(400).json({
      ok: false,
      error: "Invalid bot id"
    });
  }

  try {
    const response = await axios.post(route, yen);

    return res.status(200).json({
      ok: true,
      coordinates: response.data.coords
    });

  } catch {
    return res.status(500).json({
      ok: false,
      error: "Game server unavailable"
    });
  }
});

/* ======================
   CREATE USER
====================== */
app.post("/createuser", async (req, res) => {
  try {
    const response = await axios.post(CREATE_USER_URL, req.body);

    return res.status(200).json(response.data);

  } catch {
    return res.status(500).json({
      error: "User service unavailable"
    });
  }
});

if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
  });
}

export default app;
