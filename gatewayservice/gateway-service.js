import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
app.disable('x-powered-by');
const PORT = 8080;

// Users
const USERS = "http://localhost:4000";

// External bot server (Rust)
const GAME_SERVER = "http://localhost:4000";
const GAME_SERVER_NEW = "http://localhost:4000/game/new";
const ALLOWED_BOTS = ["random_bot", "smart_bot"];
const API_VERSION = "v1";

// middleware
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

app.use(express.json());

// NEW GAME CREATION
app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(
      `${GAME_SERVER_NEW}`,
      req.body
    );

    res.json({
      ok: true,
      yen: response.data
    });

  } catch (err) {
    return res.status(500).json({
      ok: false,
      error: "Game server unavailable"
    });
  }
});

// PLAYER VS BOT - returns the whole YEN board with a new move
app.post("/game/pvb/move", async (req, res) => {
  try {
    const { yen, bot } = req.body;

    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }

    if (!bot || !ALLOWED_BOTS.includes(bot)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

    const botUrl = new URL(`/v1/game/pvb/${bot}`, GAME_SERVER);
    const botResponse = await axios.post(botUrl.href, yen);

    return res.json({
      ok: true,
      yen: botResponse.data
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

// PLAYER VS BOT - returns the coords of the move only
app.post("/game/bot/choose", async (req, res) => {
  try {
    const { yen, bot } = req.body;

    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }

    if (!bot || !ALLOWED_BOTS.includes(bot)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

    const chooseUrl = new URL(`/v1/ybot/choose/${bot}`, GAME_SERVER);
    const response = await axios.post(chooseUrl.href, yen);

    return res.json({
      ok: true,
      coordinates: response.data
    });

  } catch (err) {
    console.log("AXIOS ERROR:", err.message);
    console.log("AXIOS ERROR FULL:", err.response?.data);

    return res.status(500).json({
      ok: false,
      error: err.message
    });
  }
});

// User creation
app.post("/createuser", async (req, res) => {
  try {
    const userUrl = new URL("/createuser", USERS);
    const response = await axios.post(userUrl.href, req.body);

    res.json(response.data);
  } catch (e) {
    res.status(500).json({
      error: "User service unavailable"
    });
  }
});

// exporting without running the server
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway Service listening on http://localhost:${PORT}`);
    console.log("Gateway connected to Rust server at", GAME_SERVER);
  });
}

export default app;