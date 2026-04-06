import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("../clients/remote-interop.client", () => ({
  remoteInteropClient: {
    getGame: vi.fn(),
    playMove: vi.fn(),
    createGame: vi.fn()
  }
}));

vi.mock("../clients/gamey.client", () => ({
  gameyClient: {
    chooseBotMove: vi.fn()
  }
}));

import { remoteInteropService } from "../services/remote-interop.service";
import { remoteInteropClient } from "../clients/remote-interop.client";
import { gameyClient } from "../clients/gamey.client";
import { remoteGameSessionsStore } from "../store/remote-game-sessions.store";

const mockedRemoteClient = vi.mocked(remoteInteropClient);
const mockedGameyClient = vi.mocked(gameyClient);

describe("remoteInteropService", () => {
  beforeEach(() => {
    vi.resetAllMocks();

    remoteGameSessionsStore.list().forEach((session) => {
      remoteGameSessionsStore.delete(session.sessionId);
    });
  });

  it("connectToRemoteGame creates and stores a session", async () => {
    mockedRemoteClient.getGame.mockResolvedValueOnce({
      game_id: "g1",
      bot_id: "remote_bot",
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      status: "ONGOING"
    });

    const result = await remoteInteropService.connectToRemoteGame({
      base_url: "http://rival-api:4001/",
      game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 0
    });

    expect(result.session_id).toBeDefined();
    expect(result.base_url).toBe("http://rival-api:4001");
    expect(result.remote_game_id).toBe("g1");
  });

  it("createRemoteGame creates session from remote create", async () => {
    mockedRemoteClient.createGame.mockResolvedValueOnce({
      game_id: "g2",
      bot_id: "remote_bot",
      position: {
        size: 5,
        turn: 0,
        players: ["B", "R"],
        layout: "./../.../..../....."
      },
      status: "ONGOING"
    });

    const result = await remoteInteropService.createRemoteGame({
      base_url: "http://rival-api:4001",
      size: 5,
      remote_bot_id: "remote_bot",
      local_bot_id: "random_bot",
      our_player_index: 1
    });

    expect(result.remote_game_id).toBe("g2");
    expect(result.our_player_index).toBe(1);
  });

  it("getRemoteGameSession returns stored session", async () => {
    mockedRemoteClient.getGame.mockResolvedValueOnce({
      game_id: "g1",
      bot_id: "remote_bot",
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      status: "ONGOING"
    });

    const created = await remoteInteropService.connectToRemoteGame({
      base_url: "http://rival-api:4001",
      game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 0
    });

    const result = remoteInteropService.getRemoteGameSession(created.session_id);

    expect(result.session_id).toBe(created.session_id);
  });

  it("getRemoteGameSession throws when missing", () => {
    expect(() =>
      remoteInteropService.getRemoteGameSession("missing")
    ).toThrow("session");
  });

  it("playRemoteTurn returns GAME_FINISHED when remote game already ended", async () => {
    mockedRemoteClient.getGame
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        game_id: "g1",
        bot_id: "remote_bot",
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "B/R./..."
        },
        status: "BOT_WON"
      });

    const session = await remoteInteropService.connectToRemoteGame({
      base_url: "http://rival-api:4001",
      game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 0
    });

    const result = await remoteInteropService.playRemoteTurn(session.session_id);

    expect(result.action).toBe("GAME_FINISHED");
  });

  it("playRemoteTurn returns WAITING_OPPONENT when it is not our turn", async () => {
    mockedRemoteClient.getGame
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        game_id: "g1",
        bot_id: "remote_bot",
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        },
        status: "ONGOING"
      });

    const session = await remoteInteropService.connectToRemoteGame({
      base_url: "http://rival-api:4001",
      game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 1
    });

    const result = await remoteInteropService.playRemoteTurn(session.session_id);

    expect(result.action).toBe("WAITING_OPPONENT");
  });

  it("playRemoteTurn returns MOVE_SUBMITTED when it is our turn", async () => {
    mockedRemoteClient.getGame
      .mockResolvedValueOnce({
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
      .mockResolvedValueOnce({
        game_id: "g1",
        bot_id: "remote_bot",
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        },
        status: "ONGOING"
      });

    mockedGameyClient.chooseBotMove.mockResolvedValueOnce({
      api_version: "v1",
      bot_id: "random_bot",
      coords: { x: 2, y: 0, z: 0 }
    });

    mockedRemoteClient.playMove.mockResolvedValueOnce({
      game_id: "g1",
      bot_id: "remote_bot",
      position: {
        size: 3,
        turn: 1,
        players: ["B", "R"],
        layout: "B/../..."
      },
      status: "ONGOING"
    });

    const session = await remoteInteropService.connectToRemoteGame({
      base_url: "http://rival-api:4001",
      game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 0
    });

    const result = await remoteInteropService.playRemoteTurn(session.session_id);

    expect(result.action).toBe("MOVE_SUBMITTED");
    expect(result.move).toEqual({ x: 2, y: 0, z: 0 });
    expect(mockedRemoteClient.playMove).toHaveBeenCalled();
  });
});