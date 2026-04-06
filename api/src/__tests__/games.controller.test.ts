import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";

vi.mock("../services/interop.service", () => ({
  interopService: {
    createGame: vi.fn(),
    getGame: vi.fn(),
    playGame: vi.fn()
  }
}));

import { gamesController } from "../controllers/games.controller";
import { interopService } from "../services/interop.service";

const mockedInteropService = vi.mocked(interopService, true);

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("gamesController", () => {
  afterEach(() => {
    vi.resetAllMocks();
  });

  it("createGame returns 201 on success", async () => {
    const req: any = {
      body: {
        size: 5,
        bot_id: "random_bot"
      }
    };
    const res = mockResponse();

    mockedInteropService.createGame.mockResolvedValueOnce({
      game_id: "g1",
      bot_id: "random_bot",
      position: {
        size: 5,
        turn: 0,
        players: ["B", "R"],
        layout: "./../.../..../....."
      },
      status: "ONGOING"
    });

    await gamesController.createGame(req, res);

    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalled();
  });

  it("createGame returns 400 on error", async () => {
    const req: any = { body: {} };
    const res = mockResponse();

    mockedInteropService.createGame.mockRejectedValueOnce(
      new Error("size must be a positive integer")
    );

    await gamesController.createGame(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "BAD_REQUEST",
      message: "size must be a positive integer"
    });
  });

  it("getGame returns 200 on success", async () => {
    const req: any = { params: { gameId: "g123" } };
    const res = mockResponse();

    mockedInteropService.getGame.mockReturnValueOnce({
      game_id: "g123",
      bot_id: "random_bot",
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      status: "ONGOING"
    });

    await gamesController.getGame(req, res);

    expect(mockedInteropService.getGame).toHaveBeenCalledWith("g123");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("getGame returns 404 when game does not exist", async () => {
    const req: any = { params: { gameId: "missing" } };
    const res = mockResponse();

    mockedInteropService.getGame.mockImplementationOnce(() => {
      throw new Error("game missing not found");
    });

    await gamesController.getGame(req, res);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      code: "NOT_FOUND",
      message: "game missing not found"
    });
  });

  it("playGame returns 200 on success", async () => {
    const req: any = {
      params: { gameId: "g123" },
      body: {
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        }
      }
    };
    const res = mockResponse();

    mockedInteropService.playGame.mockResolvedValueOnce({
      game_id: "g123",
      bot_id: "random_bot",
      position: {
        size: 3,
        turn: 1,
        players: ["B", "R"],
        layout: "B/../..."
      },
      status: "ONGOING"
    });

    await gamesController.playGame(req, res);

    expect(mockedInteropService.playGame).toHaveBeenCalledWith("g123", req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("playGame returns 400 on invalid move", async () => {
    const req: any = {
      params: { gameId: "g123" },
      body: { position: null }
    };
    const res = mockResponse();

    mockedInteropService.playGame.mockRejectedValueOnce(
      new Error("position is required")
    );

    await gamesController.playGame(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "BAD_REQUEST",
      message: "position is required"
    });
  });
});