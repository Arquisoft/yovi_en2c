import express, { NextFunction, Request, Response } from "express";
import cors from "cors";

import { healthRoutes } from "./routes/health.routes";
import { gamesRoutes } from "./routes/games.routes";
import { playRoutes } from "./routes/play.routes";
import { remoteGamesRoutes } from "./routes/remote-games.routes";
import { ErrorDto } from "./dtos/error.dto";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/health", healthRoutes);
  app.use("/games", gamesRoutes);
  app.use("/play", playRoutes);
  app.use("/remote-games", remoteGamesRoutes);

  app.use((_req: Request, res: Response) => {
    const error: ErrorDto = {
      code: "NOT_FOUND",
      message: "Route not found"
    };

    res.status(404).json(error);
  });

  app.use(
    (err: unknown, _req: Request, res: Response, _next: NextFunction) => {
      console.error("[api] unhandled error:", err);

      const error: ErrorDto = {
        code: "INTERNAL_ERROR",
        message: err instanceof Error ? err.message : "Unexpected error"
      };

      res.status(500).json(error);
    }
  );

  return app;
}