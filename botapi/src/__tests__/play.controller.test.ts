import { describe, it, expect, afterEach, vi } from "vitest";
import { Mock } from "vitest";

vi.mock("../services/interop.service", () => ({
  interopService: {
    playOnce: vi.fn()
  }
}));

import { playController } from "../controllers/play.controller";
import { interopService } from "../services/interop.service";

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("playController", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("playOnce returns 200 on success", async () => {
    const req: any = {
      body: {
        position: {
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        },
        bot_id: "random_bot"
      }
    };
    const res = mockResponse();

    (interopService.playOnce as Mock).mockResolvedValueOnce({
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

    await playController.playOnce(req, res);

    expect(interopService.playOnce).toHaveBeenCalledWith(req.body);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("playOnce returns 400 on failure", async () => {
    const req: any = { body: {} };
    const res = mockResponse();

    (interopService.playOnce as Mock).mockRejectedValueOnce(
      new Error("position is required")
    );

    await playController.playOnce(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "BAD_REQUEST",
      message: "position is required"
    });
  });
});