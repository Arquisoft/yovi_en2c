import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

describe("Gateway — Multiplayer endpoints", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── GET /multiplayer/health ───────────────────────────────────────────────

  it("GET /multiplayer/health returns 200 when multiplayer service is healthy", async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { status: "ok", service: "multiplayer" }
    });

    const res = await request(app).get("/multiplayer/health");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.service).toEqual({ status: "ok", service: "multiplayer" });
    expect(axios.get).toHaveBeenCalledTimes(1);
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/health$/)
    );
  });

  it("GET /multiplayer/health returns 502 when multiplayer service is unavailable", async () => {
    axios.get.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app).get("/multiplayer/health");

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Multiplayer service unavailable/i);
  });

  it("GET /multiplayer/health propagates downstream error status", async () => {
    axios.get.mockRejectedValueOnce({
      response: {
        status: 503,
        data: { error: "Temporarily unavailable" }
      }
    });

    const res = await request(app).get("/multiplayer/health");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Temporarily unavailable/i);
  });

  // ── GET /multiplayer/rooms/:code ──────────────────────────────────────────

  it("GET /multiplayer/rooms/:code returns room data", async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        code: "ABC123",
        size: 3,
        status: "active",
        yen: { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." },
        players: {
          B: { username: "Alice" },
          R: { username: "Bob" }
        }
      }
    });

    const res = await request(app).get("/multiplayer/rooms/abc123");

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.room.code).toBe("ABC123");
    expect(res.body.room.players.B.username).toBe("Alice");
    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/ABC123$/)
    );
  });

  it("GET /multiplayer/rooms/:code normalizes room code to uppercase", async () => {
    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { code: "QWERTY" }
    });

    await request(app).get("/multiplayer/rooms/qwerty");

    expect(axios.get).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/QWERTY$/)
    );
  });

  it("GET /multiplayer/rooms/:code propagates 404", async () => {
    axios.get.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { error: "Room not found" }
      }
    });

    const res = await request(app).get("/multiplayer/rooms/NOPE12");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Room not found/i);
  });

  // ── POST /multiplayer/room/create ─────────────────────────────────────────

  it("POST /multiplayer/room/create creates a room", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        room: {
          code: "ROOM01",
          size: 3,
          status: "waiting",
          yen: { size: 3, turn: 0, players: ["B", "R"], layout: "./../..." },
          players: {
            B: { username: "Alice" },
            R: null
          }
        },
        yourColor: "B"
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/create")
      .send({ username: "Alice", size: 3 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.room.code).toBe("ROOM01");
    expect(res.body.yourColor).toBe("B");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/create$/),
      { username: "Alice", size: 3 }
    );
  });

  it("POST /multiplayer/room/create returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/create")
      .send({ size: 3 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing username/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/create returns 400 when size is invalid", async () => {
    const res = await request(app)
      .post("/multiplayer/room/create")
      .send({ username: "Alice", size: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid board size/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/create propagates downstream error", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 502,
        data: { error: "Could not create room" }
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/create")
      .send({ username: "Alice", size: 3 });

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Could not create room/i);
  });

  // ── POST /multiplayer/room/join ───────────────────────────────────────────

  it("POST /multiplayer/room/join joins a room", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        room: {
          code: "ROOM01",
          status: "active",
          players: {
            B: { username: "Alice" },
            R: { username: "Bob" }
          }
        },
        yourColor: "R"
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/join")
      .send({ code: "room01", username: "Bob" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.yourColor).toBe("R");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/join$/),
      { code: "ROOM01", username: "Bob" }
    );
  });

  it("POST /multiplayer/room/join returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/join")
      .send({ username: "Bob" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing room code/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/join returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/join")
      .send({ code: "ROOM01" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing username/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ── POST /multiplayer/room/state ──────────────────────────────────────────

  it("POST /multiplayer/room/state forwards code and username", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        room: {
          code: "ROOM01",
          status: "active"
        },
        yourColor: "B"
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/state")
      .send({ code: "room01", username: "Alice" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.yourColor).toBe("B");
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/state$/),
      { code: "ROOM01", username: "Alice" }
    );
  });

  it("POST /multiplayer/room/state forwards code even without username", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        room: { code: "ROOM01" },
        yourColor: null
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/state")
      .send({ code: "room01" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/state$/),
      { code: "ROOM01", username: undefined }
    );
  });

  it("POST /multiplayer/room/state returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/state")
      .send({ username: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing room code/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ── POST /multiplayer/room/move ───────────────────────────────────────────

  it("POST /multiplayer/room/move forwards move correctly", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: {
        ok: true,
        room: {
          code: "ROOM01",
          yen: { size: 3, turn: 1, players: ["B", "R"], layout: "B/../..." }
        },
        finished: false,
        winner: null,
        winningEdges: []
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ code: "room01", username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/move$/),
      { code: "ROOM01", row: 0, col: 0, username: "Alice" }
    );
  });

  it("POST /multiplayer/room/move returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing room code/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/move returns 400 when row/col are missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ code: "ROOM01", username: "Alice" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing row\/col/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/move returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ code: "ROOM01", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing username/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/move propagates illegal move error", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 400,
        data: { error: "It is not your turn" }
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/move")
      .send({ code: "ROOM01", username: "Alice", row: 0, col: 0 });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not your turn/i);
  });

  // ── POST /multiplayer/room/leave ──────────────────────────────────────────

  it("POST /multiplayer/room/leave forwards leave request", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { ok: true }
    });

    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ code: "room01", username: "Bob" });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(axios.post).toHaveBeenCalledWith(
      expect.stringMatching(/\/rooms\/leave$/),
      { code: "ROOM01", username: "Bob" }
    );
  });

  it("POST /multiplayer/room/leave returns 400 when code is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ username: "Bob" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing room code/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/leave returns 400 when username is missing", async () => {
    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ code: "ROOM01" });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing username/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it("POST /multiplayer/room/leave propagates downstream 404", async () => {
    axios.post.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { error: "Room not found" }
      }
    });

    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ code: "ROOM01", username: "Bob" });

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Room not found/i);
  });

  it("POST /multiplayer/room/leave returns 502 when multiplayer service is unreachable", async () => {
    axios.post.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app)
      .post("/multiplayer/room/leave")
      .send({ code: "ROOM01", username: "Bob" });

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Multiplayer service unavailable/i);
  });
});