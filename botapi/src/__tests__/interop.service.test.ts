import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../clients/gamey.client", () => ({
  gameyClient: {
    createInitialGame: vi.fn(),
    chooseBotMove: vi.fn(),
    playAgainstBot: vi.fn()
  }
}));

import { interopService } from "../services/interop.service";
import { gameyClient } from "../clients/gamey.client";
import { activeGamesStore } from "../store/active-games.store";

const mockedClient = vi.mocked(gameyClient);

describe("interopService", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    activeGamesStore.list().forEach((game) => {
      activeGamesStore.delete(game.gameId);
    });
  });

  it("createGame creates and stores game", async () => {
    mockedClient.createInitialGame.mockResolvedValueOnce({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const result = await interopService.createGame({
      size: 3,
      bot_id: "random_bot"
    });

    expect(result.game_id).toBeDefined();
    expect(result.bot_id).toBe("random_bot");
    expect(result.status).toBe("ONGOING");
  });

  it("createGame throws when body is missing", async () => {
    await expect(interopService.createGame(undefined as any)).rejects.toThrow(
      "request body is required"
    );
  });

  it("createGame throws when size is invalid", async () => {
    await expect(
      interopService.createGame({
        size: 0,
        bot_id: "random_bot"
      })
    ).rejects.toThrow("size must be a positive integer");
  });

  it("createGame throws when bot_id is missing", async () => {
    await expect(
      interopService.createGame({
        size: 3,
        bot_id: ""
      })
    ).rejects.toThrow("bot_id is required");
  });

  it("getGame returns stored game", async () => {
    mockedClient.createInitialGame.mockResolvedValueOnce({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const created = await interopService.createGame({
      size: 3,
      bot_id: "random_bot"
    });

    const result = interopService.getGame(created.game_id);

    expect(result.game_id).toBe(created.game_id);
  });

  it("getGame throws if not found", () => {
    expect(() => interopService.getGame("fake")).toThrow("not found");
  });

  it("playGame throws if gameId is missing", async () => {
    await expect(
      interopService.playGame("", {
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        }
      })
    ).rejects.toThrow("gameId is required");
  });

  it("playGame throws if game is already finished", async () => {
    mockedClient.createInitialGame.mockResolvedValueOnce({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    mockedClient.playAgainstBot.mockResolvedValueOnce({
      yen: {
        size: 3,
        turn: 1,
        players: ["B", "R"],
        layout: "B/../..."
      },
      finished: true,
      winner: "R",
      winning_edges: []
    });

    const game = await interopService.createGame({
      size: 3,
      bot_id: "random_bot"
    });

    await interopService.playGame(game.game_id, {
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/../..."
      }
    });

    await expect(
      interopService.playGame(game.game_id, {
        position: {
          size: 3,
          turn: 1,
          players: ["B", "R"],
          layout: "B/R./..."
        }
      })
    ).rejects.toThrow("game is already finished");
  });

  it("playGame throws if position is missing", async () => {
    mockedClient.createInitialGame.mockResolvedValueOnce({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    const game = await interopService.createGame({
      size: 3,
      bot_id: "random_bot"
    });

    await expect(
      interopService.playGame(game.game_id, {} as any)
    ).rejects.toThrow("position is required");
  });

  it("playGame calls gamey and updates state", async () => {
    mockedClient.createInitialGame.mockResolvedValueOnce({
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });

    mockedClient.playAgainstBot.mockResolvedValueOnce({
      yen: {
        size: 3,
        turn: 1,
        players: ["B", "R"],
        layout: "B/../..."
      },
      finished: false,
      winner: null,
      winning_edges: []
    });

    const game = await interopService.createGame({
      size: 3,
      bot_id: "random_bot"
    });

    const result = await interopService.playGame(game.game_id, {
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "B/../..."
      }
    });

    expect(result.position.turn).toBe(1);
    expect(result.status).toBe("ONGOING");
  });

  it("playOnce throws when request is missing", async () => {
    await expect(interopService.playOnce(undefined as any)).rejects.toThrow(
      "request is required"
    );
  });

  it("playOnce throws when position is missing", async () => {
    await expect(
      interopService.playOnce({
        bot_id: "random_bot"
      } as any)
    ).rejects.toThrow("position is required");
  });

  it("playOnce uses default bot when bot_id is missing", async () => {
    mockedClient.chooseBotMove.mockResolvedValueOnce({
      api_version: "v1",
      bot_id: "random_bot",
      coords: { x: 2, y: 0, z: 0 }
    });

    const result = await interopService.playOnce({
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      bot_id: ""
    });

    expect(mockedClient.chooseBotMove).toHaveBeenCalledWith("random_bot", {
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    });
    expect(result).toEqual({
      coords: { x: 2, y: 0, z: 0 }
    });
  });

  it("playOnce returns bot coords", async () => {
    mockedClient.chooseBotMove.mockResolvedValueOnce({
      api_version: "v1",
      bot_id: "random_bot",
      coords: { x: 2, y: 0, z: 0 }
    });

    const result = await interopService.playOnce({
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      bot_id: "random_bot"
    });

    expect(result).toEqual({
      coords: { x: 2, y: 0, z: 0 }
    });
  });
});