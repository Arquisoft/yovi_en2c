jest.mock("../gamey-client", () => ({
  createNewGame: jest.fn(),
  applyPvpMove: jest.fn()
}));

process.env.NODE_ENV = "test";

const request = require("supertest");
const { createNewGame, applyPvpMove } = require("../gamey-client");
const { app, rooms } = require("../multiplayer-service");

describe("multiplayer-service HTTP", () => {
  beforeEach(() => {
    rooms.rooms.clear();
    rooms.socketToRoom.clear();
    jest.clearAllMocks();
  });

  test("GET /health returns ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
    expect(res.body.service).toBe("multiplayer");
  });

  test("POST /rooms/create creates room", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const res = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.room.players.B.username).toBe("Alice");
    expect(res.body.yourColor).toBe("B");
  });

  test("POST /rooms/create rejects invalid size", async () => {
    const res = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
  });

  test("GET /rooms/:code returns room", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    const res = await request(app).get(`/rooms/${code}`);

    expect(res.status).toBe(200);
    expect(res.body.code).toBe(code);
  });

  test("POST /rooms/join joins room", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    const res = await request(app)
      .post("/rooms/join")
      .send({ code, username: "Bob" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.room.players.R.username).toBe("Bob");
  });

  test("POST /rooms/state returns room and color", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    const res = await request(app)
      .post("/rooms/state")
      .send({ code, username: "Alice" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.yourColor).toBe("B");
  });

  test("POST /rooms/move applies move", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    applyPvpMove.mockResolvedValue({
      yen: { size: 3, turn: 1, players: ["B", "R"], layout: "B/../..." },
      finished: false,
      winner: null,
      winning_edges: []
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    await request(app)
      .post("/rooms/join")
      .send({ code, username: "Bob" });

    const res = await request(app)
      .post("/rooms/move")
      .send({ code, username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.room.yen.layout).toBe("B/../...");
  });

  test("POST /rooms/leave removes player", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    const res = await request(app)
      .post("/rooms/leave")
      .send({ code, username: "Alice" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  test("POST /rooms/state returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/rooms/state")
      .send({ username: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/room code is required/i);
  });

  test("POST /rooms/state returns null color when username is omitted", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    const res = await request(app)
      .post("/rooms/state")
      .send({ code });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.yourColor).toBeNull();
  });

  test("POST /rooms/move returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/rooms/move")
      .send({ username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/room code is required/i);
  });

  test("POST /rooms/move returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/rooms/move")
      .send({ code: "ABCD12", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username is required/i);
  });

  test("POST /rooms/move returns 404 when room does not exist", async () => {
    const res = await request(app)
      .post("/rooms/move")
      .send({ code: "NOPE12", username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/room not found/i);
  });

  test("POST /rooms/move returns 400 when user is not a player", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    await request(app)
      .post("/rooms/join")
      .send({ code, username: "Bob" });

    const res = await request(app)
      .post("/rooms/move")
      .send({ code, username: "Carol", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not a player/i);
  });

  test("POST /rooms/move returns 400 when room is finished", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    await request(app)
      .post("/rooms/join")
      .send({ code, username: "Bob" });

    rooms.finishRoom(code);

    const res = await request(app)
      .post("/rooms/move")
      .send({ code, username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/room is not active/i);
  });

  test("POST /rooms/move returns 502 when applyPvpMove fails", async () => {
    createNewGame.mockResolvedValue({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    applyPvpMove.mockRejectedValue(new Error("gamey move failed"));

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    await request(app)
      .post("/rooms/join")
      .send({ code, username: "Bob" });

    const res = await request(app)
      .post("/rooms/move")
      .send({ code, username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/gamey move failed/i);
  });

  test("POST /rooms/leave returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/rooms/leave")
      .send({ username: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/room code is required/i);
  });

  test("POST /rooms/leave returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/rooms/leave")
      .send({ code: "ABCD12" });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/username is required/i);
  });

  test("POST /rooms/leave returns 404 when room does not exist", async () => {
    const res = await request(app)
      .post("/rooms/leave")
      .send({ code: "NOPE12", username: "Alice" });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/room not found/i);
  });
});