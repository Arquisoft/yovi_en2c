import express from "express";
import axios from "axios";

const app = express();
app.disable("x-powered-by");

const PORT = 8080;

// External services
const USERS_URL = process.env.USERS_URL || "http://localhost:4000";
const GAME_URL = process.env.GAME_SERVER_URL || "http://localhost:4000";

const API_VERSION = "v1";

// Static bot route mapping
const BOT_ROUTES = {
  random_bot: {
    move: `/${API_VERSION}/game/pvb/random_bot`,
    choose: `/${API_VERSION}/ybot/choose/random_bot`
  },
  smart_bot: {
    move: `/${API_VERSION}/game/pvb/smart_bot`,
    choose: `/${API_VERSION}/ybot/choose/smart_bot`
  }
};

// Middleware
app.use(express.json());

app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

// NEW GAME
app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(
      `${GAME_URL}/game/new`,
      req.body,
      { timeout: 3000 }
    );

    return res.json({
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

// PLAYER VS BOT - MOVE
app.post("/game/pvb/move", async (req, res) => {
  try {
    const { yen, bot } = req.body;

    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }

    if (!bot || !BOT_ROUTES[bot]) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

    const response = await axios.post(
      `${GAME_URL}${BOT_ROUTES[bot].move}`,
      yen,
      { timeout: 3000 }
    );

    return res.json({
      ok: true,
      yen: response.data
    });

  } catch (err) {
    if (err.response?.data) {
      return res.status(400).json(err.response.data);
    }

    return res.status(500).json({
      ok: false,
      error: "Bot server unavailable"
    });
  }
});

// PLAYER VS BOT - CHOOSE
app.post("/game/bot/choose", async (req, res) => {
  try {
    const { yen, bot } = req.body;

    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }

    if (!bot || !BOT_ROUTES[bot]) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

    const response = await axios.post(
      `${GAME_URL}${BOT_ROUTES[bot].choose}`,
      yen,
      { timeout: 3000 }
    );

    return res.json({
      ok: true,
      coordinates: response.data
    });

  } catch {
    return res.status(500).json({
      ok: false,
      error: "Bot server unavailable"
    });
  }
});

// CREATE USER
app.post("/createuser", async (req, res) => {
  try {
    const response = await axios.post(
      `${USERS_URL}/createuser`,
      req.body,
      { timeout: 3000 }
    );

    return res.json(response.data);

  } catch {
    return res.status(500).json({
      error: "User service unavailable"
    });
  }
});

// START SERVER
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    console.log(`Game server at ${GAME_URL}`);
    console.log(`User service at ${USERS_URL}`);
  });
}

export default app;
