import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

const mockVerifyOk = () => {
  axios.get.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      user: { username: "Pablo" },
    },
  });
};

describe("Gateway — GET /stats/:username", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("should forward stats request and return 200 with stats data", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        username: "Pablo",
        stats: {
          totalGames: 10,
          wins: 7,
          losses: 3,
          winRate: 70,
          pvbGames: 8,
          pvpGames: 2,
          lastFive: [
            {
              opponent: "minimax_bot",
              result: "win",
              boardSize: 7,
              gameMode: "pvb",
              date: "2026-04-13T10:00:00Z",
            },
            {
              opponent: "heuristic_bot",
              result: "loss",
              boardSize: 9,
              gameMode: "pvb",
              date: "2026-04-12T10:00:00Z",
            },
          ],
        },
      },
    });

    const res = await request(app)
      .get("/stats/Pablo")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("success", true);
    expect(res.body).toHaveProperty("username", "Pablo");
    expect(res.body.stats).toHaveProperty("totalGames", 10);
    expect(res.body.stats).toHaveProperty("wins", 7);
    expect(res.body.stats).toHaveProperty("losses", 3);
    expect(res.body.stats).toHaveProperty("winRate", 70);
    expect(res.body.stats).toHaveProperty("pvbGames", 8);
    expect(res.body.stats).toHaveProperty("pvpGames", 2);
    expect(Array.isArray(res.body.stats.lastFive)).toBe(true);

    expect(axios.get).toHaveBeenCalledTimes(2);
    expect(axios.get).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/stats\/Pablo$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer test_token",
        }),
      })
    );
  });

  it("should forward Authorization header to users service", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        username: "Pablo",
        stats: {
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          pvbGames: 0,
          pvpGames: 0,
          lastFive: [],
        },
      },
    });

    await request(app)
      .get("/stats/Pablo")
      .set("Authorization", "Bearer my_jwt_token");

    expect(axios.get).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my_jwt_token",
        }),
      })
    );
  });

  it("should return empty stats when user has no games", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        username: "NewUser",
        stats: {
          totalGames: 0,
          wins: 0,
          losses: 0,
          winRate: 0,
          pvbGames: 0,
          pvpGames: 0,
          lastFive: [],
        },
      },
    });

    const res = await request(app)
      .get("/stats/NewUser")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(200);
    expect(res.body.stats.totalGames).toBe(0);
    expect(res.body.stats.lastFive).toEqual([]);
  });

  it("should return 404 when users service returns 404", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { success: false, error: "User NonExistent not found" },
      },
    });

    const res = await request(app)
      .get("/stats/NonExistent")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("should return 502 when users service is unreachable", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app)
      .get("/stats/Pablo")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Users service unavailable/i);
  });

  it("should return 500 when users service returns internal error", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce({
      response: {
        status: 500,
        data: { success: false, error: "Internal server error" },
      },
    });

    const res = await request(app)
      .get("/stats/Pablo")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });

  it("should propagate any error status from users service", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce({
      response: {
        status: 503,
        data: { error: "Service temporarily unavailable" },
      },
    });

    const res = await request(app)
      .get("/stats/Pablo")
      .set("Authorization", "Bearer test_token");

    expect(res.status).toBe(503);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Service temporarily unavailable/i);
  });
});