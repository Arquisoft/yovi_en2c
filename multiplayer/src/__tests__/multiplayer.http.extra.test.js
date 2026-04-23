jest.mock("../gamey-client", () => ({
  createNewGame: jest.fn(),
  applyPvpMove: jest.fn()
}));

process.env.NODE_ENV = "test";

const request = require("supertest");
const { createNewGame, applyPvpMove } = require("../gamey-client");
const { app, rooms } = require("../multiplayer-service");

describe("multiplayer-service HTTP extra coverage", () => {
  beforeEach(() => {
    rooms.rooms.clear();
    rooms.socketToRoom.clear();
    jest.clearAllMocks();
  });

  test("POST /rooms/join returns 400 when code is missing", async () => {
    const res = await request(app).post("/rooms/join").send({ username: "Bob" });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/room code is required/i);
  });

  test("GET /rooms/:code returns 404 when room does not exist", async () => {
    const res = await request(app).get("/rooms/NOPE12");
    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
  });

  test("POST /rooms/state returns 404 when room does not exist", async () => {
    const res = await request(app).post("/rooms/state").send({ code: "NOPE12", username: "Bob" });
    expect(res.status).toBe(404);
  });

  test("POST /rooms/move returns 400 when row/col are invalid", async () => {
    const res = await request(app)
      .post("/rooms/move")
      .send({ code: "ABCD12", username: "Alice", row: "x", col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/invalid row\/col/i);
  });

  test("POST /rooms/create returns 502 when createNewGame fails", async () => {
    createNewGame.mockRejectedValue(new Error("gamey down"));

    const res = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 5 });

    expect(res.status).toBe(502);
    expect(res.body.error).toMatch(/gamey down/i);
  });

  test("POST /rooms/move returns 400 when it is not your turn", async () => {
    createNewGame.mockResolvedValue({
      size: 3, turn: 0, players: ["B", "R"], layout: "./../..."
    });

    const createRes = await request(app)
      .post("/rooms/create")
      .send({ username: "Alice", size: 3 });

    const code = createRes.body.room.code;

    await request(app).post("/rooms/join").send({ code, username: "Bob" });

    const res = await request(app)
      .post("/rooms/move")
      .send({ code, username: "Bob", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/not your turn/i);
  });
});