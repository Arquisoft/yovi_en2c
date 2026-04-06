import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("../services/remote-interop.service", () => ({
  remoteInteropService: {
    connectToRemoteGame: vi.fn(),
    createRemoteGame: vi.fn(),
    getRemoteGameSession: vi.fn(),
    playRemoteTurn: vi.fn()
  }
}));

import { remoteGamesController } from "../controllers/remote-games.controller";
import { remoteInteropService } from "../services/remote-interop.service";

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("remoteGamesController", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("connectToRemoteGame returns 201", async () => {
    const req: any = {
      body: {
        base_url: "http://rival-api:4001",
        game_id: "g1",
        local_bot_id: "random_bot",
        our_player_index: 0
      }
    };
    const res = mockResponse();

    vi.mocked(remoteInteropService.connectToRemoteGame).mockResolvedValueOnce({
      session_id: "s1",
      base_url: "http://rival-api:4001",
      remote_game_id: "g1",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    await remoteGamesController.connectToRemoteGame(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("createRemoteGame returns 201", async () => {
    const req: any = {
      body: {
        base_url: "http://rival-api:4001",
        size: 5,
        remote_bot_id: "heuristic_bot",
        local_bot_id: "random_bot",
        our_player_index: 0
      }
    };
    const res = mockResponse();

    vi.mocked(remoteInteropService.createRemoteGame).mockResolvedValueOnce({
      session_id: "s2",
      base_url: "http://rival-api:4001",
      remote_game_id: "g2",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    await remoteGamesController.createRemoteGame(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("getRemoteGameSession returns 200", async () => {
    const req: any = { params: { sessionId: "s3" } };
    const res = mockResponse();

    vi.mocked(remoteInteropService.getRemoteGameSession).mockReturnValueOnce({
      session_id: "s3",
      base_url: "http://rival-api:4001",
      remote_game_id: "g3",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    await remoteGamesController.getRemoteGameSession(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("playRemoteTurn returns 200", async () => {
    const req: any = { params: { sessionId: "s4" } };
    const res = mockResponse();

    vi.mocked(remoteInteropService.playRemoteTurn).mockResolvedValueOnce({
      action: "MOVE_SUBMITTED",
      move: { x: 1, y: 1, z: 1 },
      session: {
        session_id: "s4",
        base_url: "http://rival-api:4001",
        remote_game_id: "g4",
        local_bot_id: "random_bot",
        our_player_index: 0,
        status: "ONGOING",
        created_at: "2026-04-05T12:00:00Z",
        updated_at: "2026-04-05T12:00:00Z",
        last_known_state: null
      }
    });

    await remoteGamesController.playRemoteTurn(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getRemoteGameSession returns 404 when session is missing", async () => {
    const req: any = { params: { sessionId: "missing" } };
    const res = mockResponse();

    vi.mocked(remoteInteropService.getRemoteGameSession).mockImplementationOnce(() => {
      throw new Error("remote session missing not found");
    });

    await remoteGamesController.getRemoteGameSession(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: "NOT_FOUND",
      message: "remote session missing not found"
    });
  });
});