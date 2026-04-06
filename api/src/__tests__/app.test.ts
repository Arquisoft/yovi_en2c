import { describe, it, expect, afterEach, beforeAll, vi } from "vitest";
import request from "supertest";

vi.mock("../services/interop.service", () => ({
  interopService: {
    createGame: vi.fn(),
    getGame: vi.fn(),
    playGame: vi.fn(),
    playOnce: vi.fn()
  }
}));

vi.mock("../services/remote-interop.service", () => ({
  remoteInteropService: {
    connectToRemoteGame: vi.fn(),
    createRemoteGame: vi.fn(),
    getRemoteGameSession: vi.fn(),
    playRemoteTurn: vi.fn()
  }
}));

let app: any;
let interopService: any;
let remoteInteropService: any;

describe("App", () => {
  beforeAll(async () => {
    const appModule = await import("../app");
    const interopModule = await import("../services/interop.service");
    const remoteModule = await import("../services/remote-interop.service");

    app = appModule.createApp();
    interopService = interopModule.interopService;
    remoteInteropService = remoteModule.remoteInteropService;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("GET /health returns 200", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET unknown route returns 404", async () => {
    const res = await request(app).get("/does-not-exist");

    expect(res.status).toBe(404);
    expect(res.body).toEqual({
      code: "NOT_FOUND",
      message: "Route not found"
    });
  });

  it("POST /games returns 201", async () => {
    interopService.createGame.mockResolvedValueOnce({
      game_id: "g1",
      bot_id: "random_bot",
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      status: "ONGOING"
    });

    const res = await request(app)
      .post("/games")
      .send({
        size: 3,
        bot_id: "random_bot"
      });

    expect(res.status).toBe(201);
    expect(res.body.game_id).toBe("g1");
    expect(interopService.createGame).toHaveBeenCalledWith({
      size: 3,
      bot_id: "random_bot"
    });
  });

  it("GET /games/:gameId returns 200", async () => {
    interopService.getGame.mockReturnValueOnce({
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

    const res = await request(app).get("/games/g123");

    expect(res.status).toBe(200);
    expect(res.body.game_id).toBe("g123");
    expect(interopService.getGame).toHaveBeenCalledWith("g123");
  });

  it("POST /games/:gameId/play returns 200", async () => {
    interopService.playGame.mockResolvedValueOnce({
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

    const payload = {
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      }
    };

    const res = await request(app)
      .post("/games/g123/play")
      .send(payload);

    expect(res.status).toBe(200);
    expect(res.body.game_id).toBe("g123");
    expect(interopService.playGame).toHaveBeenCalledWith("g123", payload);
  });

  it("POST /play returns 200", async () => {
    interopService.playOnce.mockResolvedValueOnce({
      bot_id: "random_bot",
      move: { x: 0, y: 0, z: 2 },
      position: {
        size: 3,
        turn: 1,
        players: ["B", "R"],
        layout: "B/../..."
      },
      status: "ONGOING"
    });

    const res = await request(app)
      .post("/play")
      .send({
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        },
        bot_id: "random_bot"
      });

    expect(res.status).toBe(200);
    expect(res.body.move).toEqual({ x: 0, y: 0, z: 2 });
  });

  it("POST /remote-games/connect returns 201", async () => {
    remoteInteropService.connectToRemoteGame.mockResolvedValueOnce({
      session_id: "s1",
      base_url: "http://rival-api:4001",
      remote_game_id: "remote-1",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    const res = await request(app)
      .post("/remote-games/connect")
      .send({
        base_url: "http://rival-api:4001",
        game_id: "remote-1",
        local_bot_id: "random_bot",
        our_player_index: 0
      });

    expect(res.status).toBe(201);
    expect(res.body.session_id).toBe("s1");
  });

  it("POST /remote-games/create returns 201", async () => {
    remoteInteropService.createRemoteGame.mockResolvedValueOnce({
      session_id: "s2",
      base_url: "http://rival-api:4001",
      remote_game_id: "remote-2",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    const res = await request(app)
      .post("/remote-games/create")
      .send({
        base_url: "http://rival-api:4001",
        size: 5,
        remote_bot_id: "heuristic_bot",
        local_bot_id: "random_bot",
        our_player_index: 0
      });

    expect(res.status).toBe(201);
    expect(res.body.session_id).toBe("s2");
  });

  it("GET /remote-games/:sessionId returns 200", async () => {
    remoteInteropService.getRemoteGameSession.mockReturnValueOnce({
      session_id: "s3",
      base_url: "http://rival-api:4001",
      remote_game_id: "remote-3",
      local_bot_id: "random_bot",
      our_player_index: 0,
      status: "ONGOING",
      created_at: "2026-04-05T12:00:00Z",
      updated_at: "2026-04-05T12:00:00Z",
      last_known_state: null
    });

    const res = await request(app).get("/remote-games/s3");

    expect(res.status).toBe(200);
    expect(res.body.session_id).toBe("s3");
  });

  it("POST /remote-games/:sessionId/play-turn returns 200", async () => {
    remoteInteropService.playRemoteTurn.mockResolvedValueOnce({
      action: "MOVE_SUBMITTED",
      move: { x: 1, y: 1, z: 1 },
      session: {
        session_id: "s4",
        base_url: "http://rival-api:4001",
        remote_game_id: "remote-4",
        local_bot_id: "random_bot",
        our_player_index: 0,
        status: "ONGOING",
        created_at: "2026-04-05T12:00:00Z",
        updated_at: "2026-04-05T12:00:00Z",
        last_known_state: null
      }
    });

    const res = await request(app).post("/remote-games/s4/play-turn");

    expect(res.status).toBe(200);
    expect(res.body.action).toBe("MOVE_SUBMITTED");
  });
});