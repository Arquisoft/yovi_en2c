import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

const fetchMock = vi.fn();

vi.stubGlobal("fetch", fetchMock);

import { gameyClient } from "../clients/gamey.client";

describe("gameyClient", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.GAMEY_BASE_URL = "http://localhost:4000";
    process.env.GAMEY_API_VERSION = "v1";
  });

  afterEach(() => {
    vi.resetModules();
  });

  it("createInitialGame calls /game/new and returns JSON", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        })
      )
    });

    const result = await gameyClient.createInitialGame(3);

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:4000/game/new", {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ size: 3 })
    });

    expect(result.size).toBe(3);
    expect(result.layout).toBe("./../...");
  });

  it("chooseBotMove calls /v1/ybot/choose/{botId}", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          api_version: "v1",
          bot_id: "random_bot",
          coords: { x: 2, y: 0, z: 0 }
        })
      )
    });

    const yen = {
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    };

    const result = await gameyClient.chooseBotMove("random_bot", yen);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/v1/ybot/choose/random_bot",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(yen)
      }
    );

    expect(result.coords).toEqual({ x: 2, y: 0, z: 0 });
  });

  it("playAgainstBot calls /v1/game/pvb/{botId}", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          yen: {
            size: 3,
            turn: 1,
            players: ["B", "R"],
            layout: "B/../..."
          },
          finished: false,
          winner: null,
          winning_edges: []
        })
      )
    });

    const yen = {
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    };

    const result = await gameyClient.playAgainstBot("random_bot", yen, 0, 0);

    expect(fetchMock).toHaveBeenCalledWith(
      "http://localhost:4000/v1/game/pvb/random_bot",
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          yen,
          row: 0,
          col: 0
        })
      }
    );

    expect(result.finished).toBe(false);
    expect(result.yen.turn).toBe(1);
  });

  it("throws gamey error message when response is not ok", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: vi.fn().mockResolvedValueOnce(
        JSON.stringify({
          message: "Bot not found"
        })
      )
    });

    await expect(gameyClient.createInitialGame(3)).rejects.toThrow("Bot not found");
  });

  it("throws default error when response is not ok and no message exists", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 500,
      text: vi.fn().mockResolvedValueOnce(JSON.stringify({}))
    });

    await expect(gameyClient.createInitialGame(3)).rejects.toThrow(
      "gamey request failed with status 500"
    );
  });
});