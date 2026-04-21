"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.interopService = void 0;
const gamey_client_1 = require("../clients/gamey.client");
const active_games_store_1 = require("../store/active-games.store");
const ids_1 = require("../utils/ids");
const yen_1 = require("../utils/yen");
class InteropService {
    async createGame(input) {
        if (!input) {
            throw new Error("request body is required");
        }
        if (!Number.isInteger(input.size) || input.size < 1) {
            throw new Error("size must be a positive integer");
        }
        if (!input.bot_id || input.bot_id.trim() === "") {
            throw new Error("bot_id is required");
        }
        const yen = await gamey_client_1.gameyClient.createInitialGame(input.size);
        (0, yen_1.assertValidYen)(yen);
        const activeGame = {
            gameId: (0, ids_1.newGameId)(),
            botId: input.bot_id,
            yen,
            status: "ONGOING",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        active_games_store_1.activeGamesStore.save(activeGame);
        return this.toGameStateDto(activeGame);
    }
    getGame(gameId) {
        if (!gameId || gameId.trim() === "") {
            throw new Error("gameId is required");
        }
        const game = active_games_store_1.activeGamesStore.getOrThrow(gameId);
        return this.toGameStateDto(game);
    }
    async playGame(gameId, input) {
        if (!gameId || gameId.trim() === "") {
            throw new Error("gameId is required");
        }
        const game = active_games_store_1.activeGamesStore.getOrThrow(gameId);
        if (game.status !== "ONGOING") {
            throw new Error("game is already finished");
        }
        if (!input?.position) {
            throw new Error("position is required");
        }
        (0, yen_1.assertValidYen)(game.yen);
        (0, yen_1.assertValidYen)(input.position);
        const move = (0, yen_1.detectSingleAddedMove)(game.yen, input.position);
        const pvbResponse = await gamey_client_1.gameyClient.playAgainstBot(game.botId, game.yen, move.row, move.col);
        const updated = {
            ...game,
            yen: pvbResponse.yen,
            status: (0, yen_1.computeStatusFromPvbResponse)(pvbResponse),
            updatedAt: new Date().toISOString()
        };
        active_games_store_1.activeGamesStore.save(updated);
        return this.toGameStateDto(updated);
    }
    async playOnce(input) {
        if (!input) {
            throw new Error("request is required");
        }
        if (!input.position) {
            throw new Error("position is required");
        }
        (0, yen_1.assertValidYen)(input.position);
        const selectedBotId = input.bot_id?.trim() || "random_bot";
        const moveResponse = await gamey_client_1.gameyClient.chooseBotMove(selectedBotId, input.position);
        return {
            bot_id: selectedBotId,
            coords: moveResponse.coords
        };
    }
    toGameStateDto(game) {
        return {
            game_id: game.gameId,
            bot_id: game.botId,
            position: game.yen,
            status: (0, yen_1.normalizeStatus)(game.status)
        };
    }
}
exports.interopService = new InteropService();
