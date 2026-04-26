import { gameyClient } from "../clients/gamey.client";
import { activeGamesStore } from "../store/active-games.store";
import { ActiveGame } from "../models/active-game.model";
import { CreateGameRequestDto } from "../dtos/create-game.dto";
import { GameStateDto } from "../dtos/game-state.dto";
import { PlayMoveRequestDto } from "../dtos/play-move.dto";
import { PlayOnceRequestDto, PlayOnceResponseDto } from "../dtos/play-once.dto";
import { newGameId } from "../utils/ids";
import {
  applyMoveToYen,
  assertValidYen,
  computeStatusFromPvbResponse,
  detectSingleAddedMove,
  normalizeStatus
} from "../utils/yen";
import { YenDto } from "../dtos/yen.dto";

class InteropService {
  async createGame(input: CreateGameRequestDto): Promise<GameStateDto> {
    if (!input) {
      throw new Error("request body is required");
    }

    if (!Number.isInteger(input.size) || input.size < 1) {
      throw new Error("size must be a positive integer");
    }

    if (!input.bot_id || input.bot_id.trim() === "") {
      throw new Error("bot_id is required");
    }

    const yen = await gameyClient.createInitialGame(input.size);
    assertValidYen(yen);

    const activeGame: ActiveGame = {
      gameId: newGameId(),
      botId: input.bot_id,
      yen,
      status: "ONGOING",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    activeGamesStore.save(activeGame);

    return this.toGameStateDto(activeGame);
  }

  getGame(gameId: string): GameStateDto {
    if (!gameId || gameId.trim() === "") {
      throw new Error("gameId is required");
    }

    const game = activeGamesStore.getOrThrow(gameId);
    return this.toGameStateDto(game);
  }

  async playGame(gameId: string, input: PlayMoveRequestDto): Promise<GameStateDto> {
    if (!gameId || gameId.trim() === "") {
      throw new Error("gameId is required");
    }

    const game = activeGamesStore.getOrThrow(gameId);

    if (game.status !== "ONGOING") {
      throw new Error("game is already finished");
    }

    if (!input?.position) {
      throw new Error("position is required");
    }

    assertValidYen(game.yen);
    assertValidYen(input.position);

    const move = detectSingleAddedMove(game.yen, input.position);

    const pvbResponse = await gameyClient.playAgainstBot(
      game.botId,
      game.yen,
      move.row,
      move.col
    );

    const updated: ActiveGame = {
      ...game,
      yen: pvbResponse.yen,
      status: computeStatusFromPvbResponse(pvbResponse),
      updatedAt: new Date().toISOString()
    };

    activeGamesStore.save(updated);

    return this.toGameStateDto(updated);
  }

  async playOnce(input: PlayOnceRequestDto): Promise<PlayOnceResponseDto> {
    if (!input) {
      throw new Error("request is required");
    }

    if (!input.position) {
      throw new Error("position is required");
    }

    assertValidYen(input.position);

    const selectedBotId = input.bot_id?.trim() || "random_bot";

    const moveResponse = await gameyClient.chooseBotMove(
      selectedBotId,
      input.position
    );

    return {
      coords: moveResponse.coords
    };
  }

  private toGameStateDto(game: ActiveGame): GameStateDto {
    return {
      game_id: game.gameId,
      bot_id: game.botId,
      position: game.yen,
      status: normalizeStatus(game.status)
    };
  }
}

export const interopService = new InteropService();