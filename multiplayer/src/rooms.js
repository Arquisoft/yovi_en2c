const { generateUniqueRoomCode } = require("./codes");

class RoomManager {
  constructor(options = {}) {
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.roomCodeLength = Number(process.env.ROOM_CODE_LENGTH || options.roomCodeLength || 6);
  }

  createRoom({ hostSocketId, username, size, yen }) {
    const code = generateUniqueRoomCode(new Set(this.rooms.keys()), this.roomCodeLength);

    const room = {
      code,
      size,
      status: "waiting",
      yen,
      createdAt: Date.now(),
      players: {
        B: {
          socketId: hostSocketId,
          username: username || "Player 1"
        },
        R: null
      }
    };

    this.rooms.set(code, room);
    this.socketToRoom.set(hostSocketId, code);

    return room;
  }

  getRoom(code) {
    return this.rooms.get(code) || null;
  }

  getRoomBySocketId(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) return null;
    return this.getRoom(code);
  }

  joinRoom({ code, socketId, username }) {
    const room = this.getRoom(code);

    if (!room) {
      throw new Error("Room not found");
    }

    if (room.status !== "waiting") {
      throw new Error("Room is not available");
    }

    if (room.players.R) {
      throw new Error("Room is already full");
    }

    room.players.R = {
      socketId,
      username: username || "Player 2"
    };
    room.status = "active";

    this.socketToRoom.set(socketId, code);

    return room;
  }

  getPlayerColor(room, socketId) {
    if (room.players.B && room.players.B.socketId === socketId) return "B";
    if (room.players.R && room.players.R.socketId === socketId) return "R";
    return null;
  }

  isPlayersTurn(room, socketId) {
    const playerColor = this.getPlayerColor(room, socketId);
    if (!playerColor) return false;

    const currentTurnIndex = room.yen.turn;
    const currentTurnColor = room.yen.players[currentTurnIndex];

    return currentTurnColor === playerColor;
  }

  updateRoomYen(code, newYen) {
    const room = this.getRoom(code);
    if (!room) return null;
    room.yen = newYen;
    return room;
  }

  finishRoom(code) {
    const room = this.getRoom(code);
    if (!room) return null;
    room.status = "finished";
    return room;
  }

  removeSocket(socketId) {
    const code = this.socketToRoom.get(socketId);
    if (!code) {
      return { room: null, removedColor: null };
    }

    const room = this.getRoom(code);
    this.socketToRoom.delete(socketId);

    if (!room) {
      return { room: null, removedColor: null };
    }

    let removedColor = null;

    if (room.players.B && room.players.B.socketId === socketId) {
      removedColor = "B";
      room.players.B = null;
    } else if (room.players.R && room.players.R.socketId === socketId) {
      removedColor = "R";
      room.players.R = null;
    }

    if (!room.players.B && !room.players.R) {
      this.rooms.delete(code);
      return { room: null, removedColor };
    }

    if (room.status === "active") {
      room.status = "finished";
    }

    return { room, removedColor };
  }

  serializeRoom(room) {
    return {
      code: room.code,
      size: room.size,
      status: room.status,
      yen: room.yen,
      createdAt: room.createdAt,
      players: {
        B: room.players.B ? { username: room.players.B.username } : null,
        R: room.players.R ? { username: room.players.R.username } : null
      }
    };
  }
}

module.exports = {
  RoomManager
};