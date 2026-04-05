import { ActiveGame } from "../models/active-game.model";

class ActiveGamesStore {
  private readonly games = new Map<string, ActiveGame>();

  save(game: ActiveGame): void {
    this.games.set(game.gameId, game);
  }

  get(gameId: string): ActiveGame | undefined {
    return this.games.get(gameId);
  }

  getOrThrow(gameId: string): ActiveGame {
    const game = this.games.get(gameId);

    if (!game) {
      throw new Error(`game ${gameId} not found`);
    }

    return game;
  }

  delete(gameId: string): boolean {
    return this.games.delete(gameId);
  }

  list(): ActiveGame[] {
    return Array.from(this.games.values());
  }
}

export const activeGamesStore = new ActiveGamesStore();