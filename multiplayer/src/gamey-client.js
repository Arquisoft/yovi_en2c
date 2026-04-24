const axios = require("axios");

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://localhost:4000";

async function createNewGame(size) {
  const response = await axios.post(
    `${GAMEY_BASE_URL}/game/new`,
    { size },
    {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 5000
    }
  );

  return response.data;
}

async function applyPvpMove(yen, row, col) {
  const response = await axios.post(
    `${GAMEY_BASE_URL}/v1/game/pvp/move`,
    { yen, row, col },
    {
      headers: {
        "Content-Type": "application/json"
      },
      timeout: 5000
    }
  );

  return response.data;
}

module.exports = {
  createNewGame,
  applyPvpMove
};