import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

// Minimal YEN object used across tests
const YEN = { size: 7, turn: 0, layout: "......./....../...../..../.../../." };

describe("Gateway — POST /hint", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  // ── Happy path ──────────────────────────────────────────────────────────────

  it("returns coords when gamey responds correctly", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { coords: { x: 3, y: 2, z: 1 } },
    });

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    expect(res.body.coords).toEqual({ x: 3, y: 2, z: 1 });
  });

  it("always uses alfa_beta_bot regardless of any bot_id sent in body", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { coords: { x: 1, y: 0, z: 5 } },
    });

    // Even if the caller sends bot_id: "random_bot", the gateway must use alfa_beta_bot
    await request(app).post("/hint").send({ yen: YEN, bot_id: "random_bot" });

    expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/alfa_beta_bot$/),
        YEN
    );
  });

  it("never calls a route other than alfa_beta_bot", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { coords: { x: 0, y: 0, z: 6 } },
    });

    await request(app).post("/hint").send({ yen: YEN, bot_id: "monte_carlo_extreme" });

    const calledUrl = axios.post.mock.calls[0][0];
    expect(calledUrl).toMatch(/alfa_beta_bot$/);
    expect(calledUrl).not.toMatch(/monte_carlo/);
    expect(calledUrl).not.toMatch(/random_bot/);
    expect(calledUrl).not.toMatch(/heuristic_bot/);
  });

  it("forwards the YEN object directly to gamey", async () => {
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { coords: { x: 2, y: 1, z: 3 } },
    });

    const customYen = { size: 9, turn: 4, layout: "custom_layout" };
    await request(app).post("/hint").send({ yen: customYen });

    expect(axios.post).toHaveBeenCalledWith(
        expect.any(String),
        customYen
    );
  });

  it("falls back to coords when gamey returns data directly without .coords wrapper", async () => {
    // Some bot routes return coords at root level
    axios.post.mockResolvedValueOnce({
      status: 200,
      data: { x: 0, y: 3, z: 3 },
    });

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
    // coords should be whatever data comes back
    expect(res.body.coords).toBeDefined();
  });

  // ── Validation errors ───────────────────────────────────────────────────────

  it("returns 400 when body is an empty object", async () => {
    const res = await request(app).post("/hint").send({});

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Missing YEN/i);
    expect(axios.post).not.toHaveBeenCalled();
  });

  // ── Gamey error forwarding ──────────────────────────────────────────────────

  it("returns 502 when gamey is unreachable", async () => {
    axios.post.mockRejectedValueOnce(new Error("Connection refused"));

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Game server unavailable/i);
  });

  it("propagates 503 from gamey", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 503, data: { error: "Bot temporarily unavailable" } },
    });

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Bot temporarily unavailable/i);
  });

  it("propagates 422 from gamey when YEN state is invalid", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 422, data: { error: "Invalid board state" } },
    });

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(422);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid board state/i);
  });

  it("propagates string error message from gamey response data", async () => {
    axios.post.mockRejectedValueOnce({
      response: { status: 400, data: "Bad yen format" },
    });

    const res = await request(app).post("/hint").send({ yen: YEN });

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Bad yen format/i);
  });
});