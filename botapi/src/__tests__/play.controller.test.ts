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
      query: {
        position: JSON.stringify({
          size: 3,
          turn: 0,
          players: ["B", "R"],
          layout: "./../..."
        }),
        bot_id: "random_bot"
      }
    };
    const res = mockResponse();

    (interopService.playOnce as Mock).mockResolvedValueOnce({
      bot_id: "random_bot",
      coords: { x: 0, y: 0, z: 2 }
    });

    await playController.playOnce(req, res);

    expect(interopService.playOnce).toHaveBeenCalledWith({
      position: {
        size: 3,
        turn: 0,
        players: ["B", "R"],
        layout: "./../..."
      },
      bot_id: "random_bot"
    });
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      bot_id: "random_bot",
      coords: { x: 0, y: 0, z: 2 }
    });
  });

  it("playOnce returns 400 on failure", async () => {
    const req: any = {
      query: {}
    };
    const res = mockResponse();

    await playController.playOnce(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      code: "BAD_REQUEST",
      message: "position query parameter is required"
    });
  });
});