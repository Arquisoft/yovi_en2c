import { describe, it, expect, beforeEach, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import { remoteInteropClient } from "../clients/remote-interop.client";

describe("remoteInteropClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it("getGame fetches remote game", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          game_id: "g1",
          bot_id: "remote_bot",
          position: {
            size: 3,
            turn: 0,
            players: ["B", "R"],
            layout: "./../..."
          },
          status: "ONGOING"
        })
      )
    });

    const result = await remoteInteropClient.getGame("http://localhost:4001/", "g1");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4001/games/g1");
    expect(result.game_id).toBe("g1");
  });

  it("playMove posts remote move", async () => {
    const position = {
      size: 3,
      turn: 1,
      players: ["B", "R"],
      layout: "B/../..."
    };

    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          game_id: "g1",
          bot_id: "remote_bot",
          position,
          status: "ONGOING"
        })
      )
    });

    const result = await remoteInteropClient.playMove(
      "http://localhost:4001",
      "g1",
      position
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4001/games/g1/play",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ position })
      }
    );

    expect(result.position.layout).toBe("B/../...");
  });

  it("createGame posts remote game creation", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          game_id: "g2",
          bot_id: "remote_bot",
          position: {
            size: 5,
            turn: 0,
            players: ["B", "R"],
            layout: "./../.../..../....."
          },
          status: "ONGOING"
        })
      )
    });

    const result = await remoteInteropClient.createGame("http://localhost:4001", {
      size: 5,
      bot_id: "remote_bot"
    });

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4001/games", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        size: 5,
        bot_id: "remote_bot"
      })
    });

    expect(result.game_id).toBe("g2");
  });

  it("throws remote API message on error", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          message: "Remote game not found"
        })
      )
    });

    await expect(
      remoteInteropClient.getGame("http://localhost:4001", "missing")
    ).rejects.toThrow("Remote game not found");
  });

  it("throws default remote API error when no message exists", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValueOnce(JSON.stringify({}))
    });

    await expect(
      remoteInteropClient.getGame("http://localhost:4001", "g1")
    ).rejects.toThrow("remote API request failed with status 500");
  });
});