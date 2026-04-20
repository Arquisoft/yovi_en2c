import { Request, Response } from "express";
import { gameService } from "../services/game.service";

type GameParams = {
    id: string;
};

class GamesController {
    async create(req: Request, res: Response) {
        const { botId, position } = req.body;
        const game = gameService.createGame(botId, position);
        res.status(201).json(game);
    }

    async get(req: Request<GameParams>, res: Response) {
        const game = gameService.getGame(req.params.id);
        res.json(game);
    }

    async play(req: Request<GameParams>, res: Response) {
        const result = await gameService.playMove(
            req.params.id,
            req.body.position
        );

        res.json(result);
    }
}

// ✅ THIS is what you were missing
export const gamesController = new GamesController();