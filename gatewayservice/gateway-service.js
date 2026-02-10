import express from "express";
import axios from "axios";
import crypto from "crypto";

const app = express();
const PORT = 8080;

// External bot server (Rust)
const BOT_SERVER = "http://gamey:4000";
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

// in memory games currently to support multiplayer
const games = new Map();

// YEN HELPERS

/**
 * Create an empty YEN board
 */
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

/**
 * Apply a move using a linear index
 */
function applyMove(yen, idx, player) {
  if (yen.turn !== player) {
    throw new Error("Not this player's turn");
  }

  const rows = yen.layout.split("/");
  let counter = 0;

  for (let r = 0; r < rows.length; r++) {
    const cells = rows[r].split("");
    for (let c = 0; c < cells.length; c++) {
      if (counter === idx) {
        if (cells[c] !== ".") {
          throw new Error("Cell already occupied");
        }
        cells[c] = yen.players[player];
        rows[r] = cells.join("");
        return {
          ...yen,
          layout: rows.join("/"),
          turn: 1 - yen.turn
        };
      }
      counter++;
    }
  }

  throw new Error("Index out of bounds");
}

// Utils
function getGame(gameId) {
  const game = games.get(gameId);
  if (!game) {
    throw new Error("Game not found");
  }
  return game;
}

// PVP version
/**
 * Start a new PVP game
 * Body: { size }
 */
app.post("/game/pvp/start", (req, res) => {
  const size = req.body.size || 7;
  const gameId = crypto.randomUUID();

  games.set(gameId, {
    mode: "pvp",
    yen: createEmptyYEN(size),
    status: "ongoing",
    winner: null
  });

  res.json({
    ok: true,
    gameId,
    yen: games.get(gameId).yen
  });
});

/**
 * Apply a move in a PVP game
 * Body: { gameId, idx, player }
 */
app.post("/game/pvp/move", (req, res) => {
  try {
    const { gameId, idx, player } = req.body;
    const game = getGame(gameId);

    game.yen = applyMove(game.yen, idx, player);

    res.json({ ok: true, yen: game.yen });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * Get current PVP game state
 */
app.get("/game/pvp/state", (req, res) => {
  try {
    const { gameId } = req.query;
    const game = getGame(gameId);

    res.json({ ok: true, yen: game.yen });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

// PVB version
/**
 * Start a new PVB game
 * Body: { size, bot }
 */
app.post("/game/pvb/start", (req, res) => {
  const size = req.body.size || 7;
  const bot = req.body.bot || "random_bot";
  const gameId = crypto.randomUUID();

  games.set(gameId, {
    mode: "pvb",
    yen: createEmptyYEN(size),
    bot,
    status: "ongoing",
    winner: null
  });

  res.json({
    ok: true,
    gameId,
    yen: games.get(gameId).yen
  });
});

/**
 * Apply a move in a PVB game
 * Body: { gameId, idx, player }
 */
app.post("/game/pvb/move", async (req, res) => {
  try {
    const { gameId, idx, player } = req.body;
    const game = getGame(gameId);

    // Human move
    game.yen = applyMove(game.yen, idx, player);

    // Bot move (YEN in -> index out)
    const botResponse = await axios.post(
      `${BOT_SERVER}/${API_VERSION}/ybot/choose/${game.bot}`,
      game.yen
    );

    const botIdx = botResponse.data.idx;

    game.yen = applyMove(game.yen, botIdx, game.yen.turn);

    res.json({ ok: true, yen: game.yen });
  } catch (e) {
    res.status(400).json({ ok: false, error: e.message });
  }
});

/**
 * Get current PVB game state
 */
app.get("/game/pvb/state", (req, res) => {
  try {
    const { gameId } = req.query;
    const game = getGame(gameId);

    res.json({ ok: true, yen: game.yen });
  } catch (e) {
    res.status(404).json({ ok: false, error: e.message });
  }
});

// Server start
app.listen(PORT, () => {
  console.log(`Gateway Service listening on http://localhost:${PORT}`);
});

/**
 * User creation.
 */
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
