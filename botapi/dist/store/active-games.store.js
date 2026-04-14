"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activeGamesStore = void 0;
class ActiveGamesStore {
    games = new Map();
    save(game) {
        this.games.set(game.gameId, game);
    }
    get(gameId) {
        return this.games.get(gameId);
    }
    getOrThrow(gameId) {
        const game = this.games.get(gameId);
        if (!game) {
            throw new Error(`game ${gameId} not found`);
        }
        return game;
    }
    delete(gameId) {
        return this.games.delete(gameId);
    }
    list() {
        return Array.from(this.games.values());
    }
}
exports.activeGamesStore = new ActiveGamesStore();
