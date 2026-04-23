const { RoomManager } = require("../src/rooms");

describe("RoomManager", () => {
  let manager;
  let yen;

  beforeEach(() => {
    manager = new RoomManager({ roomCodeLength: 6 });
    yen = { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." };
  });

  test("createRoom creates waiting room with player B", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    expect(room.code).toBeDefined();
    expect(room.status).toBe("waiting");
    expect(room.players.B.username).toBe("Alice");
    expect(room.players.R).toBeNull();
  });

  test("createRoom stores socket mapping when socketId is provided", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen,
      socketId: "socket-1"
    });

    expect(manager.socketToRoom.get("socket-1")).toBe(room.code);
  });

  test("joinRoom adds second player and activates room", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    const joined = manager.joinRoom({
      code: room.code,
      username: "Bob"
    });

    expect(joined.status).toBe("active");
    expect(joined.players.R.username).toBe("Bob");
  });

  test("joinRoom throws if room does not exist", () => {
    expect(() =>
      manager.joinRoom({ code: "XXXXXX", username: "Bob" })
    ).toThrow("Room not found");
  });

  test("joinRoom throws if room is not waiting", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob"
    });

    expect(() =>
      manager.joinRoom({ code: room.code, username: "Carol" })
    ).toThrow("Room is not available");
  });

  test("getPlayerColorByUsername returns correct color", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob"
    });

    expect(manager.getPlayerColorByUsername(room, "Alice")).toBe("B");
    expect(manager.getPlayerColorByUsername(room, "Bob")).toBe("R");
    expect(manager.getPlayerColorByUsername(room, "Nobody")).toBeNull();
  });

  test("attachSocketToPlayer associates socket with existing player", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    manager.attachSocketToPlayer(room.code, "Alice", "socket-1");

    expect(room.players.B.socketId).toBe("socket-1");
    expect(manager.socketToRoom.get("socket-1")).toBe(room.code);
  });

  test("getPlayerColor returns correct color by socketId", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen,
      socketId: "socket-a"
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob",
      socketId: "socket-b"
    });

    expect(manager.getPlayerColor(room, "socket-a")).toBe("B");
    expect(manager.getPlayerColor(room, "socket-b")).toBe("R");
    expect(manager.getPlayerColor(room, "socket-x")).toBeNull();
  });

  test("isPlayersTurnByUsername checks YEN turn", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen: { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." }
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob"
    });

    expect(manager.isPlayersTurnByUsername(room, "Alice")).toBe(true);
    expect(manager.isPlayersTurnByUsername(room, "Bob")).toBe(false);
  });

  test("isPlayersTurn checks turn by socket", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen: { size: 3, turn: 1, players: ["B", "R"], layout: "./../..." },
      socketId: "socket-a"
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob",
      socketId: "socket-b"
    });

    expect(manager.isPlayersTurn(room, "socket-a")).toBe(false);
    expect(manager.isPlayersTurn(room, "socket-b")).toBe(true);
  });

  test("updateRoomYen updates stored state", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    const newYen = { size: 3, turn: 1, players: ["B", "R"], layout: "B/../..." };
    manager.updateRoomYen(room.code, newYen);

    expect(manager.getRoom(room.code).yen).toEqual(newYen);
  });

  test("finishRoom sets status finished", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    manager.finishRoom(room.code);
    expect(manager.getRoom(room.code).status).toBe("finished");
  });

  test("removePlayerByUsername removes player and deletes room if empty", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen
    });

    const result = manager.removePlayerByUsername(room.code, "Alice");

    expect(result.removedColor).toBe("B");
    expect(manager.getRoom(room.code)).toBeNull();
  });

  test("removeSocket detaches socket and finishes active room", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen,
      socketId: "socket-a"
    });

    manager.joinRoom({
      code: room.code,
      username: "Bob",
      socketId: "socket-b"
    });

    const result = manager.removeSocket("socket-a");

    expect(result.removedColor).toBe("B");
    expect(room.players.B.socketId).toBeNull();
    expect(room.status).toBe("finished");
  });

  test("serializeRoom hides socket ids", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen,
      socketId: "socket-a"
    });

    const serialized = manager.serializeRoom(room);

    expect(serialized.players.B).toEqual({ username: "Alice" });
    expect(serialized.players.B.socketId).toBeUndefined();
  });
});