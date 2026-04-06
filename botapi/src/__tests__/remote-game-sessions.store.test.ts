import { describe, it, expect, beforeEach } from "vitest";
import { remoteGameSessionsStore } from "../store/remote-game-sessions.store";

describe("remoteGameSessionsStore", () => {
  const sampleSession = {
    sessionId: "s1",
    baseUrl: "http://rival-api:4001",
    remoteGameId: "rg1",
    localBotId: "random_bot",
    ourPlayerIndex: 0,
    status: "ONGOING" as const,
    createdAt: "2026-04-05T12:00:00Z",
    updatedAt: "2026-04-05T12:00:00Z",
    lastKnownState: null
  };

  beforeEach(() => {
    remoteGameSessionsStore.list().forEach((session) => {
      remoteGameSessionsStore.delete(session.sessionId);
    });
  });

  it("saves and gets a session", () => {
    remoteGameSessionsStore.save(sampleSession);

    expect(remoteGameSessionsStore.get("s1")).toEqual(sampleSession);
  });

  it("get returns undefined when missing", () => {
    expect(remoteGameSessionsStore.get("missing")).toBeUndefined();
  });

  it("getOrThrow returns session when found", () => {
    remoteGameSessionsStore.save(sampleSession);

    expect(remoteGameSessionsStore.getOrThrow("s1")).toEqual(sampleSession);
  });

  it("getOrThrow throws when missing", () => {
    expect(() => remoteGameSessionsStore.getOrThrow("missing")).toThrow(
      "remote session missing not found"
    );
  });

  it("delete removes a session", () => {
    remoteGameSessionsStore.save(sampleSession);

    expect(remoteGameSessionsStore.delete("s1")).toBe(true);
    expect(remoteGameSessionsStore.get("s1")).toBeUndefined();
  });

  it("list returns all sessions", () => {
    remoteGameSessionsStore.save(sampleSession);

    expect(remoteGameSessionsStore.list()).toHaveLength(1);
  });
});