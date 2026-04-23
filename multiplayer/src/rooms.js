const { generateUniqueRoomCode } = require("./codes");

class RoomManager {
  constructor(options = {}) {
    this.rooms = new Map();
    this.socketToRoom = new Map();
    this.roomCodeLength = Number(process.env.ROOM_CODE_LENGTH || options.roomCodeLength || 6);
  }

  createRoom({ username, size, yen, socketId = null }) {
    const code = generateUniqueRoomCode(new Set(this.rooms.keys()), this.roomCodeLength);

    const room = {
      code,
      size,
      status: "waiting",
      yen,
      createdAt: Date.now(),
      players: {
        B: {
          username: username || "Player 1",
          socketId
        },
        R: null
      }
    };

    this.rooms.set(code, room);

    if (socketId) {
      this.socketToRoom.set(socketId, code);
    }

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

  getPlayerColorByUsername(room, username) {
    if (!room || !username) return null;
    if (room.players.B && room.players.B.username === username) return "B";
    if (room.players.R && room.players.R.username === username) return "R";
    return null;
  }

  getPlayerColor(room, socketId) {
    if (!room || !socketId) return null;
    if (room.players.B && room.players.B.socketId === socketId) return "B";
    if (room.players.R && room.players.R.socketId === socketId) return "R";
    return null;
  }

  joinRoom({ code, username, socketId = null }) {
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
      username: username || "Player 2",
      socketId
    };

    room.status = "active";

    if (socketId) {
      this.socketToRoom.set(socketId, code);
    }

    return room;
  }

  attachSocketToPlayer(code, username, socketId) {
    const room = this.getRoom(code);

    if (!room) {
      throw new Error("Room not found");
    }

    const color = this.getPlayerColorByUsername(room, username);
    if (!color) {
      throw new Error("Player not found in room");
    }

    room.players[color].socketId = socketId;
    this.socketToRoom.set(socketId, code);

    return room;
  }

  detachSocket(socketId) {
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
      room.players.B.socketId = null;
      removedColor = "B";
    } else if (room.players.R && room.players.R.socketId === socketId) {
      room.players.R.socketId = null;
      removedColor = "R";
    }

    return { room, removedColor };
  }

  removePlayerByUsername(code, username) {
    const room = this.getRoom(code);
    if (!room) {
      return { room: null, removedColor: null };
    }

    let removedColor = null;
    let removedSocketId = null;

    if (room.players.B && room.players.B.username === username) {
      removedColor = "B";
      removedSocketId = room.players.B.socketId;
      room.players.B = null;
    } else if (room.players.R && room.players.R.username === username) {
      removedColor = "R";
      removedSocketId = room.players.R.socketId;
      room.players.R = null;
    }

    if (removedSocketId) {
      this.socketToRoom.delete(removedSocketId);
    }

    if (!removedColor) {
      return { room, removedColor: null };
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
      room.players.B.socketId = null;
    } else if (room.players.R && room.players.R.socketId === socketId) {
      removedColor = "R";
      room.players.R.socketId = null;
    }

    if (room.status === "active") {
      room.status = "finished";
    }

    return { room, removedColor };
  }

  getCurrentTurnColor(room) {
    if (!room?.yen?.players) return null;
    const currentTurnIndex = room.yen.turn;
    return room.yen.players[currentTurnIndex] || null;
  }

  isPlayersTurn(room, socketId) {
    const playerColor = this.getPlayerColor(room, socketId);
    if (!playerColor) return false;

    return this.getCurrentTurnColor(room) === playerColor;
  }

  isPlayersTurnByUsername(room, username) {
    const playerColor = this.getPlayerColorByUsername(room, username);
    if (!playerColor) return false;

    return this.getCurrentTurnColor(room) === playerColor;
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