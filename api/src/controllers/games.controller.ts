import type { Request, Response } from "express";
import { interopService } from "../services/interop.service";
import type { CreateGameRequestDto } from "../dtos/create-game.dto";
import type { PlayMoveRequestDto } from "../dtos/play-move.dto";
import type { ErrorDto } from "../dtos/error.dto";

type GameParams = {
  gameId: string;
};

class GamesController {
  constructor() {
    this.createGame = this.createGame.bind(this);
    this.getGame = this.getGame.bind(this);
    this.playGame = this.playGame.bind(this);
  }

  async createGame(req: Request<{}, {}, CreateGameRequestDto>, res: Response) {
    try {
      const body = req.body;
      const result = await interopService.createGame(body);
      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getGame(req: Request<GameParams>, res: Response) {
    try {
      const { gameId } = req.params;
      const result = interopService.getGame(gameId);
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async playGame(
    req: Request<GameParams, {}, PlayMoveRequestDto>,
    res: Response
  ) {
    try {
      const { gameId } = req.params;
      const body = req.body;
      const result = await interopService.playGame(gameId, body);
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response) {
    const err = error instanceof Error ? error : new Error("Unexpected error");
    const status = this.inferStatus(err.message);

    const body: ErrorDto = {
      code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
      message: err.message
    };

    res.status(status).json(body);
  }

  private inferStatus(message: string): number {
    if (message.includes("not found")) {
      return 404;
    }

    return 400;
  }
}

export const gamesController = new GamesController();