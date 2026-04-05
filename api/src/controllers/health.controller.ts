import { Request, Response } from "express";

class HealthController {
  healthCheck(_req: Request, res: Response) {
    res.status(200).json({ status: "ok" });
  }
}

export const healthController = new HealthController();