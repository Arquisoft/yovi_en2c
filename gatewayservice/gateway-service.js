import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = 8080;

// External bot server (Rust)
const BOT_SERVER = "http://localhost:3000"; //pending checking
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

// in memory games currently to support several users in the app
//const games = new Map();

// YEN HELPERS

// Create an empty YEN board
function createEmptyYEN(size) {
  const rows = [];
  for (let i = 1; i <= size; i++) {
    rows.push(".".repeat(i));
  }

  return {
    size,
    turn: 0,
    players: ["B", "R"],
    layout: rows.join("/")
  };
}


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
    console.log("Calling:", `${BOT_SERVER}/${API_VERSION}/ybot/choose/${botId}`);

    const botResponse = await axios.post(
      `${BOT_SERVER}/${API_VERSION}/ybot/choose/${botId}`,
      yen
    );

    return res.json({
      ok: true,
      botMove: botResponse.data
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
