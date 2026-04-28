require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const promBundle = require("express-prom-bundle");

const { RoomManager } = require("./rooms");
const { createNewGame, applyPvpMove } = require("./gamey-client");

const PORT = Number(process.env.PORT || 7000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const app = express();
app.disable("x-powered-by");

app.use(express.json());
app.use(
    cors({
      origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
      methods: ["GET", "POST", "OPTIONS"]
    })
);

// Standard: express-prom-bundle exposes /metrics automatically.
// normalizePath prevents high-cardinality labels from dynamic route params.
const metricsMiddleware = promBundle({
  includeMethod: true,
  includePath: true,
  includeStatusCode: true,
  normalizePath: [
    ['^/rooms/[A-Z0-9]+$', '/rooms/:code'],
  ],
});
app.use(metricsMiddleware);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const rooms = new RoomManager();

// HELPERS ----------------------------------------------------------------------

function parseRoomCode(value) {
  return String(value || "").trim().toUpperCase();
}

function parseUsername(value, fallback = "") {
  return String(value || fallback).trim();
}

function parseBoardSize(value, fallback = 3) {
  const size = value === undefined ? fallback : Number(value);
  return Number.isInteger(size) && size > 0 ? size : null;
}

function parseMoveCoordinates(rowValue, colValue) {
  const row = Number(rowValue);
  const col = Number(colValue);

  if (!Number.isInteger(row) || !Number.isInteger(col)) {
    return null;
  }

  return { row, col };
}

function serializeRoom(room) {
  return rooms.serializeRoom(room);
}

function badRequest(res, error) {
  return res.status(400).json({ ok: false, error });
}

function notFound(res, error) {
  return res.status(404).json({ ok: false, error });
}

function gatewayError(res, error, fallback) {
  return res.status(502).json({
    ok: false,
    error: error.response?.data?.error || error.message || fallback
  });
}

function socketError(callback, error) {
  callback({ ok: false, error });
}

function emitRoomUpdated(room) {
  io.to(room.code).emit("room_updated", {
    room: serializeRoom(room)
  });
}

function emitGameStartedIfReady(room) {
  if (room.players.B && room.players.R) {
    io.to(room.code).emit("game_started", {
      room: serializeRoom(room),
      message: "Both players connected"
    });
  }
}

function emitGameState(code, room, result) {
  const payload = {
    room: serializeRoom(room),
    finished: result.finished,
    winner: result.winner,
    winningEdges: result.winning_edges
  };

  io.to(code).emit("game_updated", payload);

  if (result.finished) {
    io.to(code).emit("game_over", payload);
  }
}

function emitOpponentLeft(code, room, removedColor) {
  io.to(code).emit("opponent_left", {
    room: serializeRoom(room),
    removedColor
  });
}

function updateRoomAfterMove(code, result) {
  rooms.updateRoomYen(code, result.yen);

  if (result.finished) {
    rooms.finishRoom(code);
  }

  return rooms.getRoom(code);
}

async function buildNewRoom(username, size, socketId = null) {
  const yen = await createNewGame(size);

  return rooms.createRoom({
    username,
    size,
    yen,
    socketId
  });
}

function getRoomOrThrow(code) {
  const room = rooms.getRoom(code);
  if (!room) {
    throw new Error("Room not found");
  }
  return room;
}

function validateMoveAccess(room, playerColor, isPlayersTurn) {
  if (room.status !== "active") {
    throw new Error("Room is not active");
  }

  if (!playerColor) {
    throw new Error("You are not a player in this room");
  }

  if (!isPlayersTurn) {
    throw new Error("It is not your turn");
  }
}
// --------------------------------------------------------------------------------

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "multiplayer"
  });
});

app.get("/rooms/:code", (req, res) => {
  const code = parseRoomCode(req.params.code);
  const room = rooms.getRoom(code);

  if (!room) {
    return res.status(404).json({ ok: false, error: "Room not found" });
  }

  return res.json(serializeRoom(room));
});

app.post("/rooms/create", async (req, res) => {
  try {
    const username = parseUsername(req.body?.username, "Player 1");
    const size = parseBoardSize(req.body?.size);

    if (size === null) {
      return badRequest(res, "Invalid board size");
    }

    const room = await buildNewRoom(username, size);

    return res.status(200).json({
      ok: true,
      room: serializeRoom(room),
      yourColor: "B"
    });
  } catch (error) {
    return gatewayError(res, error, "Could not create room");
  }
});

app.post("/rooms/join", (req, res) => {
  try {
    const code = parseRoomCode(req.body?.code);
    const username = parseUsername(req.body?.username, "Player 2");

    if (!code) return badRequest(res, "Room code is required");

    const room = rooms.joinRoom({ code, username });

    emitRoomUpdated(room);
    emitGameStartedIfReady(room);

    return res.status(200).json({
      ok: true,
      room: serializeRoom(room),
      yourColor: "R"
    });
  } catch (error) {
    return badRequest(res, error.message || "Could not join room");
  }
});

app.post("/rooms/state", (req, res) => {
  try {
    const code = parseRoomCode(req.body?.code);
    const username = req.body?.username ? parseUsername(req.body.username) : null;

    if (!code) {
      return badRequest(res, "Room code is required");
    }

    const room = rooms.getRoom(code);

    if (!room) {
      return notFound(res, "Room not found");
    }

    return res.status(200).json({
      ok: true,
      room: serializeRoom(room),
      yourColor: username ? rooms.getPlayerColorByUsername(room, username) : null
    });
  } catch (error) {
    return badRequest(res, error.message || "Could not get room state");
  }
});

app.post("/rooms/move", async (req, res) => {
  try {
    const code = parseRoomCode(req.body?.code);
    const username = parseUsername(req.body?.username);
    const move = parseMoveCoordinates(req.body?.row, req.body?.col);

    if (!code) return badRequest(res, "Room code is required");
    if (!username) return badRequest(res, "Username is required");
    if (!move) return badRequest(res, "Invalid row/col");

    const room = rooms.getRoom(code);
    if (!room) return notFound(res, "Room not found");

    const playerColor = rooms.getPlayerColorByUsername(room, username);
    const isPlayersTurn = rooms.isPlayersTurnByUsername(room, username);

    validateMoveAccess(room, playerColor, isPlayersTurn);

    const result = await applyPvpMove(room.yen, move.row, move.col);
    const updatedRoom = updateRoomAfterMove(code, result);

    emitGameState(code, updatedRoom, result);

    return res.status(200).json({
      ok: true,
      room: serializeRoom(updatedRoom),
      finished: result.finished,
      winner: result.winner,
      winningEdges: result.winning_edges
    });
  } catch (error) {
    if (
        error.message === "Room is not active" ||
        error.message === "You are not a player in this room" ||
        error.message === "It is not your turn"
    ) {
      return badRequest(res, error.message);
    }

    if (error.message === "Room not found") {
      return notFound(res, error.message);
    }

    return gatewayError(res, error, "Invalid move");
  }
});

app.post("/rooms/leave", (req, res) => {
  try {
    const code = parseRoomCode(req.body?.code);
    const username = parseUsername(req.body?.username);

    if (!code) return badRequest(res, "Room code is required");
    if (!username) return badRequest(res, "Username is required");

    const room = rooms.getRoom(code);
    if (!room) return notFound(res, "Room not found");

    const result = rooms.removePlayerByUsername(code, username);

    if (result.room) {
      emitOpponentLeft(code, result.room, result.removedColor);
    }

    return res.status(200).json({ ok: true });
  } catch (error) {
    return badRequest(res, error.message || "Could not leave room");
  }
});

io.on("connection", (socket) => {
  socket.emit("connected", {
    socketId: socket.id,
    message: "Connected to multiplayer service"
  });

  socket.on("create_room", async (payload = {}, callback = () => {}) => {
    try {
      const username = parseUsername(payload.username, "Player 1");
      const size = parseBoardSize(payload.size);

      if (size === null) {
        return socketError(callback, "Invalid board size");
      }

      const room = await buildNewRoom(username, size, socket.id);

      socket.join(room.code);

      callback({
        ok: true,
        room: serializeRoom(room),
        yourColor: "B"
      });

      emitRoomUpdated(room);
    } catch (error) {
      callback({
        ok: false,
        error: error.response?.data?.error || error.message || "Could not create room"
      });
    }
  });

  socket.on("join_room", (payload = {}, callback = () => {}) => {
    try {
      const code = parseRoomCode(payload.code);
      const username = parseUsername(payload.username, "Player 2");

      if (!code) return socketError(callback, "Room code is required");

      const existingRoom = getRoomOrThrow(code);
      const existingColor = rooms.getPlayerColorByUsername(existingRoom, username);

      const room = existingColor
          ? rooms.attachSocketToPlayer(code, username, socket.id)
          : rooms.joinRoom({ code, username, socketId: socket.id });

      socket.join(room.code);

      callback({
        ok: true,
        room: serializeRoom(room),
        yourColor: rooms.getPlayerColor(room, socket.id)
      });

      emitRoomUpdated(room);
      emitGameStartedIfReady(room);
    } catch (error) {
      socketError(callback, error.message || "Could not join room");
    }
  });

  socket.on("get_room_state", (payload = {}, callback = () => {}) => {
    try {
      const code = parseRoomCode(payload.code);
      const room = getRoomOrThrow(code);

      callback({
        ok: true,
        room: serializeRoom(room),
        yourColor: rooms.getPlayerColor(room, socket.id)
      });
    } catch (error) {
      callback({
        ok: false,
        error: error.message || "Could not get room state"
      });
    }
  });

  socket.on("make_move", async (payload = {}, callback = () => {}) => {
    try {
      const code = parseRoomCode(payload.code);
      const move = parseMoveCoordinates(payload.row, payload.col);

      if (!move) {
        return socketError(callback, "Invalid row/col");
      }

      const room = getRoomOrThrow(code);
      const playerColor = rooms.getPlayerColor(room, socket.id);
      const isPlayersTurn = rooms.isPlayersTurn(room, socket.id);

      validateMoveAccess(room, playerColor, isPlayersTurn);

      const result = await applyPvpMove(room.yen, move.row, move.col);
      const updatedRoom = updateRoomAfterMove(code, result);

      emitGameState(code, updatedRoom, result);

      callback({
        ok: true,
        room: serializeRoom(updatedRoom),
        finished: result.finished,
        winner: result.winner,
        winningEdges: result.winning_edges
      });
    } catch (error) {
      callback({
        ok: false,
        error: error.response?.data?.error || error.message || "Invalid move"
      });
    }
  });

  socket.on("leave_room", (payload = {}, callback = () => {}) => {
    try {
      const code = parseRoomCode(payload.code);
      const room = getRoomOrThrow(code);

      socket.leave(code);

      const result = rooms.removeSocket(socket.id);

      if (result.room) {
        emitOpponentLeft(code, result.room, result.removedColor);
      }

      callback({ ok: true, room: serializeRoom(room) });
    } catch (error) {
      socketError(callback, error.message || "Could not leave room");
    }
  });

  socket.on("disconnect", () => {
    const result = rooms.removeSocket(socket.id);

    if (result.room) {
      emitOpponentLeft(result.room.code, result.room, result.removedColor);
    }
  });
});

if (process.env.NODE_ENV !== "test") {
  server.listen(PORT, () => {
    console.log(`Realtime multiplayer service running on http://localhost:${PORT}`);
    console.log(`Health endpoint: http://localhost:${PORT}/health`);
    console.log(`Metrics endpoint: http://localhost:${PORT}/metrics`);
  });
}

module.exports = { app, server, io, rooms };