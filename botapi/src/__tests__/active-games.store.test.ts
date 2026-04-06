import { describe, it, expect, beforeEach } from "vitest";
import { activeGamesStore } from "../store/active-games.store";

describe("activeGamesStore", () => {
  const sampleGame = {
    gameId: "g1",
    botId: "random_bot",
    yen: {
      size: 3,
      turn: 0,
      players: ["B", "R"],
      layout: "./../..."
    },
    status: "ONGOING" as const,
    createdAt: "2026-04-05T12:00:00Z",
    updatedAt: "2026-04-05T12:00:00Z"
  };

  beforeEach(() => {
    activeGamesStore.list().forEach((game) => {
      activeGamesStore.delete(game.gameId);
    });
  });

  it("saves and gets a game", () => {
    activeGamesStore.save(sampleGame);

    expect(activeGamesStore.get("g1")).toEqual(sampleGame);
  });

  it("get returns undefined when missing", () => {
    expect(activeGamesStore.get("missing")).toBeUndefined();
  });

  it("getOrThrow returns game when found", () => {
    activeGamesStore.save(sampleGame);

    expect(activeGamesStore.getOrThrow("g1")).toEqual(sampleGame);
  });

  it("getOrThrow throws when missing", () => {
    expect(() => activeGamesStore.getOrThrow("missing")).toThrow(
      "game missing not found"
    );
  });

  it("delete removes a game", () => {
    activeGamesStore.save(sampleGame);

    expect(activeGamesStore.delete("g1")).toBe(true);
    expect(activeGamesStore.get("g1")).toBeUndefined();
  });

  it("list returns all games", () => {
    activeGamesStore.save(sampleGame);

    expect(activeGamesStore.list()).toHaveLength(1);
  });
});