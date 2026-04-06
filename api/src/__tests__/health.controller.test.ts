import { describe, it, expect, vi } from "vitest";
import { healthController } from "../controllers/health.controller";

function mockResponse() {
  const res: any = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

describe("healthController", () => {
  it("healthCheck returns ok", () => {
    const req: any = {};
    const res = mockResponse();

    healthController.healthCheck(req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ status: "ok" });
  });
});