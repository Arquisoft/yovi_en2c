import express from "express";
import axios from "axios";

const PORT = 8080;

// external
const USERS = process.env.USERS_URL || "http://localhost:4000";
const GAME_SERVER = process.env.GAME_SERVER_URL || "http://localhost:4000";
const ALLOWED_BOTS = ["random_bot", "smart_bot"];
const API_VERSION = "v1";

// middleware
app.use(express.json());
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
    const url = new URL("/game/new", GAME_SERVER);

    const response = await axios.post(url.href, req.body, {
      timeout: 3000
    });

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

    const url = new URL(`/${API_VERSION}/game/pvb/${bot}`, GAME_SERVER);

    const response = await axios.post(url.href, yen, {
      timeout: 3000
    });

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

    const url = new URL(`/${API_VERSION}/ybot/choose/${bot}`, GAME_SERVER);

    const response = await axios.post(url.href, yen, {
      timeout: 3000
    });

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

// User creation
app.post("/createuser", async (req, res) => {
  try {
    const url = new URL("/createuser", USERS);

    const response = await axios.post(url.href, req.body, {
      timeout: 3000
    });

    return res.json(response.data);

  } catch {
    return res.status(500).json({
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