import express from "express";
import axios from "axios";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;

// Base URLs - validated and sanitized
const GAME_BASE_URL = process.env.GAME_SERVER_URL || "http://localhost:4000";
const USERS_BASE_URL = process.env.USERS_URL || "http://localhost:3000";
const API_VERSION = "v1";

// Helper function to safely build URLs
function buildBotUrl(baseUrl, endpoint) {
  // Validate base URL format
  const urlPattern = /^https?:\/\/.+$/;
  if (!urlPattern.test(baseUrl)) {
    throw new Error("Invalid base URL format");
  }
  
  // Return the full URL
  return baseUrl + endpoint;
}

// STATIC SAFE ROUTES - built using helper function
const BOT_MOVE_ROUTES = {
  random_bot: buildBotUrl(GAME_BASE_URL, `/${API_VERSION}/game/pvb/random_bot`),
  smart_bot: buildBotUrl(GAME_BASE_URL, `/${API_VERSION}/game/pvb/smart_bot`)
};

const BOT_CHOOSE_ROUTES = {
  random_bot: buildBotUrl(GAME_BASE_URL, `/${API_VERSION}/ybot/choose/random_bot`),
  smart_bot: buildBotUrl(GAME_BASE_URL, `/${API_VERSION}/ybot/choose/smart_bot`)
};

// Static routes for other endpoints
const GAME_NEW_URL = buildBotUrl(GAME_BASE_URL, "/game/new");
const CREATE_USER_URL = buildBotUrl(USERS_BASE_URL, "/createuser");

app.use(express.json());

// NEW GAME
app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(
      GAME_NEW_URL,
      req.body
    );
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

// PVB MOVE
app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot } = req.body;
  
  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: "Missing YEN"
    });
  }
  
  if (!bot || !BOT_MOVE_ROUTES[bot]) {
    return res.status(400).json({
      ok: false,
      error: "Invalid bot id"
    });
  }
  
  try {
    const response = await axios.post(
      BOT_MOVE_ROUTES[bot],
      yen
    );
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

// BOT CHOOSE
app.post("/game/bot/choose", async (req, res) => {
  const { yen, bot } = req.body;
  
  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: "Missing YEN"
    });
  }
  
  if (!bot || !BOT_CHOOSE_ROUTES[bot]) {
    return res.status(400).json({
      ok: false,
      error: "Invalid bot id"
    });
  }
  
  try {
    const response = await axios.post(
      BOT_CHOOSE_ROUTES[bot],
      yen
    );
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

// CREATE USER
app.post("/createuser", async (req, res) => {
  try {
    const response = await axios.post(
      CREATE_USER_URL,
      req.body
    );
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