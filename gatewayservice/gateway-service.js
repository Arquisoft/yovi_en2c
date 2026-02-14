import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = 8080;

// External bot server (Rust)
const GAME_SERVER = "http://localhost:3000";
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
      `${GAME_SERVER}/game/new`,
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

// PLAYER VS BOT
app.post("/game/pvb/move", async (req, res) => {
  try {
    const { yen, bot } = req.body;

    if (!yen) {
      return res.status(400).json({
        ok: false,
        error: "Missing YEN object"
      });
    }

    const botId = bot || "random_bot";
    console.log("Calling ->", `${GAME_SERVER}/${API_VERSION}/game/pvb/${botId}`);
    const botResponse = await axios.post(
      `${GAME_SERVER}/${API_VERSION}/game/pvb/${botId}`,
      yen
    );

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

// Server start
app.listen(PORT, () => {
  console.log(`Gateway Service listening on http://localhost:${PORT}`);
  console.log("Gateway connected to Rust server at", GAME_SERVER);
});


// User creation
app.post("/createuser", async (req, res) => {
  try {
    const response = await axios.post(
      "http://localhost:3000/createuser",
      req.body
    );

    res.json(response.data);
  } catch (e) {
    res.status(500).json({
      error: "User service unavailable"
    });
  }
});
