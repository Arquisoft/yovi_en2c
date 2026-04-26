import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

afterEach(() => {
  vi.clearAllMocks();
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /game/check  (ruta sin cobertura)
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — POST /game/check", () => {

  const YEN = { size: 7, turn: 3, layout: "B...../...../...../...../...../...../....."}; 

  it("returns 400 when yen is missing", async () => {
    const res = await request(app).post("/game/check").send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing YEN/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("returns game state with finished: false when game is ongoing", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { yen: YEN, finished: false, winner: null, winning_edges: [] },
    });

    const res = await request(app).post("/game/check").send({ yen: YEN });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.finished).toBe(false);
    expect(res.body.winner).toBeNull();
    expect(res.body.winning_edges).toEqual([]);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/game\/check$/),
      { yen: YEN }
    );
  });

  it("returns finished: true with winner and winning_edges when game is over", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        yen: YEN,
        finished: true,
        winner: "B",
        winning_edges: [[0, 0], [0, 1], [0, 2]],
      },
    });

    const res = await request(app).post("/game/check").send({ yen: YEN });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.finished).toBe(true);
    expect(res.body.winner).toBe("B");
    expect(res.body.winning_edges).toEqual([[0, 0], [0, 1], [0, 2]]);
  });

  it("falls back to request yen when response does not include yen field", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { finished: false },
    });

    const res = await request(app).post("/game/check").send({ yen: YEN });

    expect(res.status).toBe(200);
    expect(res.body.yen).toEqual(YEN);
  });

  it("returns 502 when game server is unreachable", async () => {
    axios.post.mockRejectedValueOnce(new Error("Connection refused"));

    const res = await request(app).post("/game/check").send({ yen: YEN });

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Game server unavailable/i);
  });

  it("propagates error status from game server", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 422, data: { error: "Invalid board state" } },
    });

    const res = await request(app).post("/game/check").send({ yen: YEN });

    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid board state/i);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /gameresult/multiplayer  (ruta sin cobertura)
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — POST /gameresult/multiplayer", () => {

  const payload = {
    roomCode: "ROOM01",
    winner: "Alice",
    players: { B: "Alice", R: "Bob" },
    boardSize: 7,
    moves: 12,
  };

  it("forwards multiplayer game result and returns 201", async () => {
    axios.post.mockResolvedValueOnce({
      status: 201,
      data: { success: true, message: "Multiplayer result saved" },
    });

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toMatch(/saved/i);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/gameresult\/multiplayer$/),
      payload
    );
  });

  it("returns 502 when users service is unreachable", async () => {
    axios.post.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send(payload);

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Users service unavailable/i);
  });

  it("propagates 400 from users service", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 400, data: { error: "Missing required fields" } },
    });

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing required fields/i);
  });

  it("propagates 500 from users service", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send(payload);

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Casos edge de rutas ya existentes (aumentan cobertura de helpers)
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — validateUsernameParam edge cases", () => {

  it("GET /stats/:username returns 400 for invalid username (special chars)", async () => {
    const res = await request(app)
      .get("/stats/inval!d<user>")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid username/i);
    expect(axios.get).not.toHaveBeenCalled();
  });


  it("PATCH /profile/:username returns 400 for invalid username", async () => {
    const res = await request(app)
      .patch("/profile/<script>")
      .set("Authorization", "Bearer token")
      .send({ bio: "test" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("POST /friends/request/:username returns 400 for invalid username", async () => {
    const res = await request(app)
      .post("/friends/request/bad user!")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /friends/accept/:username returns 400 for invalid username", async () => {
    const res = await request(app)
      .post("/friends/accept/bad<user>")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("DELETE /friends/:username returns 400 for invalid username", async () => {
    const res = await request(app)
      .delete("/friends/bad<user>")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.delete).not.toHaveBeenCalled();
  });
});

describe("Gateway — DELETE /friends/:username extra coverage", () => {

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).delete("/friends/alice");

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Authorization header required/i);
    expect(axios.delete).not.toHaveBeenCalled();
  });

  it("propagates 404 when friendship does not exist", async () => {
    axios.delete.mockRejectedValueOnce({
      response: { status: 404, data: { error: "Friendship not found" } },
    });

    const res = await request(app)
      .delete("/friends/alice")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 502 when users service is unreachable", async () => {
    axios.delete.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app)
      .delete("/friends/alice")
      .set("Authorization", "Bearer token");

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Users service unavailable/i);
  });
});

describe("Gateway — PATCH /profile extra coverage", () => {

  it("strips extra fields from body — only allowed fields are forwarded", async () => {
    axios.patch.mockResolvedValueOnce({
      status: 200,
      data: { success: true, profile: {} },
    });

    await request(app)
      .patch("/profile/testuser")
      .set("Authorization", "Bearer token")
      .send({
        bio: "hello",
        password: "hacked",       // should be stripped
        role: "admin",            // should be stripped
        __proto__: { evil: true } // should be stripped
      });

    const calledBody = axios.patch.mock.calls[0][1];
    expect(calledBody).not.toHaveProperty("password");
    expect(calledBody).not.toHaveProperty("role");
    expect(calledBody.bio).toBe("hello");
  });
});

describe("Gateway — multiplayer invalid room code edge cases", () => {

  it("GET /multiplayer/rooms/:code returns 400 for invalid room code", async () => {
    const res = await request(app).get("/multiplayer/rooms/bad<code>");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/join returns 400 for invalid username", async () => {
    const res = await request(app)
      .post("/multiplayer/room/join")
      .send({ code: "ROOM01", username: "bad user!" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/move returns 400 for invalid username", async () => {
    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ code: "ROOM01", username: "bad<user>", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/leave returns 400 for invalid username", async () => {
    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ code: "ROOM01", username: "bad<user>" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(axios.post).not.toHaveBeenCalled();
  });
});
