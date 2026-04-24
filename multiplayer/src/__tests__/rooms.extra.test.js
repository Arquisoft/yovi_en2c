const { RoomManager } = require("../rooms");

describe("RoomManager extra coverage", () => {
  let manager;
  let yen;

  beforeEach(() => {
    manager = new RoomManager({ roomCodeLength: 6 });
    yen = { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." };
  });

  test("createRoom uses default username when username is empty", () => {
    const room = manager.createRoom({ username: "", size: 3, yen });

    expect(room.players.B.username).toBe("Player 1");
  });

  test("joinRoom uses default username when username is empty", () => {
    const room = manager.createRoom({ username: "Alice", size: 3, yen });

    const joined = manager.joinRoom({ code: room.code, username: "" });

    expect(joined.players.R.username).toBe("Player 2");
  });

  test("joinRoom throws when room is already full", () => {
    const room = manager.createRoom({ username: "Alice", size: 3, yen });

    manager.joinRoom({ code: room.code, username: "Bob" });
    room.status = "waiting";

    expect(() =>
      manager.joinRoom({ code: room.code, username: "Carol" })
    ).toThrow("Room is already full");
  });

  test("attachSocketToPlayer throws when room does not exist", () => {
    expect(() =>
      manager.attachSocketToPlayer("NOPE12", "Alice", "socket-x")
    ).toThrow("Room not found");
  });

  test("attachSocketToPlayer throws when username is not in room", () => {
    const room = manager.createRoom({ username: "Alice", size: 3, yen });

    expect(() =>
      manager.attachSocketToPlayer(room.code, "Nobody", "socket-x")
    ).toThrow("Player not found in room");
  });

  test("detachSocket returns null result for unknown socket", () => {
    const result = manager.detachSocket("missing-socket");

    expect(result).toEqual({ room: null, removedColor: null });
  });

  test("detachSocket removes socket mapping but keeps waiting room alive", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen,
      socketId: "socket-a",
    });

    const result = manager.detachSocket("socket-a");

    expect(result.room.code).toBe(room.code);
    expect(result.removedColor).toBe("B");
    expect(room.players.B.socketId).toBeNull();
    expect(room.status).toBe("waiting");
    expect(manager.socketToRoom.has("socket-a")).toBe(false);
  });

  test("removePlayerByUsername returns room with null color if username is not present", () => {
    const room = manager.createRoom({ username: "Alice", size: 3, yen });

    const result = manager.removePlayerByUsername(room.code, "Nobody");

    expect(result.room).toBe(room);
    expect(result.removedColor).toBeNull();
  });

  test("removePlayerByUsername finishes active room when one player leaves", () => {
    const room = manager.createRoom({ username: "Alice", size: 3, yen });
    manager.joinRoom({ code: room.code, username: "Bob" });

    const result = manager.removePlayerByUsername(room.code, "Bob");

    expect(result.removedColor).toBe("R");
    expect(result.room.status).toBe("finished");
    expect(result.room.players.R).toBeNull();
  });

  test("updateRoomYen returns null for missing room", () => {
    expect(manager.updateRoomYen("NOPE12", yen)).toBeNull();
  });

  test("finishRoom returns null for missing room", () => {
    expect(manager.finishRoom("NOPE12")).toBeNull();
  });

  test("getCurrentTurnColor returns null when yen players are missing", () => {
    const room = manager.createRoom({
      username: "Alice",
      size: 3,
      yen: { size: 3, turn: 0, layout: "./../..." },
    });

    expect(manager.getCurrentTurnColor(room)).toBeNull();
  });
});