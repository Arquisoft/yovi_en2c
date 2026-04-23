require("dotenv").config();

const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");

const { RoomManager } = require("./rooms");
const { createNewGame, applyPvpMove } = require("./gamey-client");

const PORT = Number(process.env.PORT || 7000);
const CORS_ORIGIN = process.env.CORS_ORIGIN || "*";

const GAMEY_BASE_URL = process.env.GAMEY_BASE_URL || "http://localhost:4000"; //NOSONAR

const app = express();
app.disable("x-powered-by");

app.use(express.json());
app.use(
  cors({
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    methods: ["GET", "POST", "OPTIONS"]
  })
);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: CORS_ORIGIN === "*" ? true : CORS_ORIGIN,
    methods: ["GET", "POST"]
  }
});

const rooms = new RoomManager();

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "multiplayer"
  });
});

app.get("/rooms/:code", (req, res) => {
  const room = rooms.getRoom(req.params.code);

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  return res.json(rooms.serializeRoom(room));
});

io.on("connection", (socket) => {
  socket.emit("connected", {
    socketId: socket.id,
    message: "Connected to multiplayer service"
  });

  socket.on("create_room", async (payload = {}, callback = () => {}) => {
    try {
      const username = String(payload.username || "Player 1");
      const size = Number(payload.size || 3);

      if (!Number.isInteger(size) || size < 1) {
        callback({ ok: false, error: "Invalid board size" });
        return;
      }

      const yen = await createNewGame(size);

      const room = rooms.createRoom({
        hostSocketId: socket.id,
        username,
        size,
        yen
      });

      socket.join(room.code);

      callback({
        ok: true,
        room: rooms.serializeRoom(room),
        yourColor: "B"
      });

      io.to(room.code).emit("room_updated", {
        room: rooms.serializeRoom(room)
      });
    } catch (error) {
      callback({
        ok: false,
        error: error.response?.data?.error || error.message || "Could not create room"
      });
    }
  });

  socket.on("join_room", (payload = {}, callback = () => {}) => {
    try {
      const code = String(payload.code || "").trim().toUpperCase();
      const username = String(payload.username || "Player 2");

      if (!code) {
        callback({ ok: false, error: "Room code is required" });
        return;
      }

      const room = rooms.joinRoom({
        code,
        socketId: socket.id,
        username
      });

      socket.join(room.code);

      callback({
        ok: true,
        room: rooms.serializeRoom(room),
        yourColor: "R"
      });

      io.to(room.code).emit("room_updated", {
        room: rooms.serializeRoom(room)
      });

      io.to(room.code).emit("game_started", {
        room: rooms.serializeRoom(room),
        message: "Both players connected"
      });
    } catch (error) {
      callback({
        ok: false,
        error: error.message || "Could not join room"
      });
    }
  });

  socket.on("get_room_state", (payload = {}, callback = () => {}) => {
    try {
      const code = String(payload.code || "").trim().toUpperCase();
      const room = rooms.getRoom(code);

      if (!room) {
        callback({ ok: false, error: "Room not found" });
        return;
      }

      callback({
        ok: true,
        room: rooms.serializeRoom(room),
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
      const code = String(payload.code || "").trim().toUpperCase();
      const row = Number(payload.row);
      const col = Number(payload.col);

      const room = rooms.getRoom(code);

      if (!room) {
        callback({ ok: false, error: "Room not found" });
        return;
      }

      if (room.status !== "active") {
        callback({ ok: false, error: "Room is not active" });
        return;
      }

      const playerColor = rooms.getPlayerColor(room, socket.id);
      if (!playerColor) {
        callback({ ok: false, error: "You are not a player in this room" });
        return;
      }

      if (!rooms.isPlayersTurn(room, socket.id)) {
        callback({ ok: false, error: "It is not your turn" });
        return;
      }

      const result = await applyPvpMove(room.yen, row, col);

      rooms.updateRoomYen(code, result.yen);

      if (result.finished) {
        rooms.finishRoom(code);
      }

      const updatedRoom = rooms.getRoom(code);

      io.to(code).emit("game_updated", {
        room: rooms.serializeRoom(updatedRoom),
        finished: result.finished,
        winner: result.winner,
        winningEdges: result.winning_edges
      });

      if (result.finished) {
        io.to(code).emit("game_over", {
          room: rooms.serializeRoom(updatedRoom),
          winner: result.winner,
          winningEdges: result.winning_edges
        });
      }

      callback({
        ok: true,
        room: rooms.serializeRoom(updatedRoom),
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
      const code = String(payload.code || "").trim().toUpperCase();
      const room = rooms.getRoom(code);

      if (!room) {
        callback({ ok: false, error: "Room not found" });
        return;
      }

      socket.leave(code);

      const result = rooms.removeSocket(socket.id);

      if (result.room) {
        io.to(code).emit("opponent_left", {
          room: rooms.serializeRoom(result.room),
          removedColor: result.removedColor
        });
      }

      callback({ ok: true });
    } catch (error) {
      callback({
        ok: false,
        error: error.message || "Could not leave room"
      });
    }
  });

  socket.on("disconnect", () => {
    const result = rooms.removeSocket(socket.id);

    if (result.room) {
      io.to(result.room.code).emit("opponent_left", {
        room: rooms.serializeRoom(result.room),
        removedColor: result.removedColor
      });
    }
  });
});

server.listen(PORT, () => {
  console.log(`Realtime multiplayer service running on http://localhost:${PORT}`);
  console.log(`Health endpoint: http://localhost:${PORT}/health`);
});