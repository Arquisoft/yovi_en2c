import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import mongoose from "mongoose";
import app from "../users-service.js";

describe("POST /gameresult/multiplayer", () => {
  afterEach(() => vi.restoreAllMocks());

  it("returns 400 when players are the same", async () => {
    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({ player1: "alice", player2: "alice", winner: "alice", boardSize: 7 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must be different/i);
  });

  it("returns 400 when winner is not one of the players", async () => {
    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({ player1: "alice", player2: "bob", winner: "carol", boardSize: 7 });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/winner must be one of the two players/i);
  });

  it("returns 404 when player1 does not exist", async () => {
    vi.spyOn(mongoose.Model, "findOne")
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ username: "bob" });

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({ player1: "alice", player2: "bob", winner: "bob", boardSize: 7 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/alice/i);
  });

  it("uses fallback boardSize 7 when invalid", async () => {
    vi.spyOn(mongoose.Model, "findOne")
      .mockResolvedValueOnce({ username: "alice" })
      .mockResolvedValueOnce({ username: "bob" });

    const insertManySpy = vi.spyOn(mongoose.Model, "insertMany").mockResolvedValueOnce([
      { username: "alice", boardSize: 7, result: "win", gameMode: "pvp" },
      { username: "bob", boardSize: 7, result: "loss", gameMode: "pvp" },
    ]);

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({ player1: "alice", player2: "bob", winner: "alice", boardSize: 0 });

    expect(res.status).toBe(201);
    expect(insertManySpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ boardSize: 7, gameMode: "pvp" }),
        expect.objectContaining({ boardSize: 7, gameMode: "pvp" }),
      ])
    );
  });

  it("returns 500 when insertMany fails", async () => {
    vi.spyOn(mongoose.Model, "findOne")
      .mockResolvedValueOnce({ username: "alice" })
      .mockResolvedValueOnce({ username: "bob" });

    vi.spyOn(mongoose.Model, "insertMany").mockRejectedValueOnce(new Error("bulk fail"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await request(app)
      .post("/gameresult/multiplayer")
      .send({ player1: "alice", player2: "bob", winner: "alice", boardSize: 7 });

    expect(res.status).toBe(500);
    expect(res.body.error).toMatch(/bulk fail/i);
  });
});