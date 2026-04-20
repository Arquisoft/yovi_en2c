import { games, Game } from "../models/game.model";
import { botService } from "./bot.service";
import { v4 as uuid } from "uuid";

class GameService {
    createGame(botId: string, initialPosition: any): Game {
        const game: Game = {
            id: uuid(),
            botId,
            position: initialPosition,
            status: "ONGOING"
        };

        games.set(game.id, game);
        return game;
    }

    getGame(id: string) {
        const game = games.get(id);
        if (!game) throw new Error("game not found");
        return game;
    }

    async playMove(id: string, position: any) {
        const game = this.getGame(id);

        const move = await botService.getMove(game.botId, position);

        game.position = position; // simplified
        return { game, move };
    }
}

export const gameService = new GameService();