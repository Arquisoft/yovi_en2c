import express from "express";
import axios from "axios";

const app = express();
app.disable("x-powered-by");
const PORT = 8080;

const GAME_BASE_URL = "http://localhost:4000";
const USER_BASE_URL = "http://localhost:3000";

app.use(express.json());


// NEW GAME
app.post("/game/new", async (req, res) => {
  try {
    const response = await axios.post(
      `${GAME_BASE_URL}/game/new`,
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

//PVB MOVE
app.post("/game/pvb/move", async (req, res) => {
  const { yen, bot } = req.body;

  if (!yen) {
    return res.status(400).json({
      ok: false,
      error: "Missing YEN"
    });
  }

  try {
    let response;

    if (bot === "random_bot") {
      response = await axios.post(
        `${GAME_BASE_URL}/v1/game/pvb/random_bot`,
        yen
      );
    } else if (bot === "smart_bot") {
      response = await axios.post(
        `${GAME_BASE_URL}/v1/game/pvb/smart_bot`,
        yen
      );
    } else {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

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

  try {
    let response;

    if (bot === "random_bot") {
      response = await axios.post(
        `${GAME_BASE_URL}/v1/ybot/choose/random_bot`,
        yen
      );
    } else if (bot === "smart_bot") {
      response = await axios.post(
        `${GAME_BASE_URL}/v1/ybot/choose/smart_bot`,
        yen
      );
    } else {
      return res.status(400).json({
        ok: false,
        error: "Invalid bot id"
      });
    }

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
      `${USER_BASE_URL}/createuser`,
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
