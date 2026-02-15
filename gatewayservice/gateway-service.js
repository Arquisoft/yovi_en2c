import express from "express";
import axios from "axios";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;

// External services (validated base URLs)
const USERS_BASE = process.env.USERS_URL || "http://localhost:4000";
const GAME_BASE = process.env.GAME_SERVER_URL || "http://localhost:4000";

// Use Set for O(1) lookup instead of array includes
const ALLOWED_BOTS = new Set(["random_bot", "smart_bot"]);

const API_VERSION = "v1";

// Validate protocol once (avoid SSRF hotspot)
function validateBaseUrl(base) {
  const url = new URL(base);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Invalid service protocol");
  }
  return url;
}

const USERS_URL = validateBaseUrl(USERS_BASE);
const GAME_URL = validateBaseUrl(GAME_BASE);

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
    const url = new URL("/game/new", GAME_URL);
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

// PVB MOVE
app.post("/game/pvb/move", async (req, res) => {
  try {
    const { yen, bot } = req.body;
    
    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }
    
    if (!bot || !ALLOWED_BOTS.has(bot)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }
    
    // Build URL safely - use template literal for path string, then pass to URL constructor
    const url = new URL(`/${API_VERSION}/game/pvb/${bot}`, GAME_URL);
    
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

// BOT CHOOSE
app.post("/game/bot/choose", async (req, res) => {
  try {
    const { yen, bot } = req.body;
    
    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }
    
    if (!bot || !ALLOWED_BOTS.has(bot)) {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }
    
    // Build URL safely - use template literal for path string, then pass to URL constructor
    const url = new URL(`/${API_VERSION}/ybot/choose/${bot}`, GAME_URL);
    
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

// CREATE USER
app.post("/createuser", async (req, res) => {
  try {
    const url = new URL("/createuser", USERS_URL);
    
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

// START SERVER
if (process.env.NODE_ENV !== "test") {
  app.listen(PORT, () => {
    console.log(`Gateway listening on http://localhost:${PORT}`);
    console.log("Connected to Game server at", GAME_URL.href);
  });
}

export default app;