import { remoteInteropClient } from "../clients/remote-interop.client";
import { gameyClient } from "../clients/gamey.client";
import { remoteGameSessionsStore } from "../store/remote-game-sessions.store";
import { RemoteGameSession } from "../models/remote-game-session.model";
import { RemoteConnectRequestDto } from "../dtos/remote-connect.dto";
import { RemoteCreateRequestDto } from "../dtos/remote-create.dto";
import {
  RemoteGameSessionDto,
  RemotePlayTurnResponseDto
} from "../dtos/remote-session.dto";
import { newGameId } from "../utils/ids";
import { applyMoveToYen } from "../utils/yen";
import { GameStateDto } from "../dtos/game-state.dto";

class RemoteInteropService {
  async connectToRemoteGame(
    input: RemoteConnectRequestDto
  ): Promise<RemoteGameSessionDto> {
    this.validateConnectInput(input);

    const remoteState = await remoteInteropClient.getGame(
      input.base_url,
      input.game_id
    );

    const session: RemoteGameSession = {
      sessionId: newGameId(),
      baseUrl: this.normalizeBaseUrl(input.base_url),
      remoteGameId: input.game_id,
      localBotId: input.local_bot_id,
      ourPlayerIndex: input.our_player_index,
      status: remoteState.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastKnownState: remoteState
    };

    remoteGameSessionsStore.save(session);

    return this.toDto(session);
  }

  async createRemoteGame(
    input: RemoteCreateRequestDto
  ): Promise<RemoteGameSessionDto> {
    this.validateCreateInput(input);

    const remoteState = await remoteInteropClient.createGame(input.base_url, {
      size: input.size,
      bot_id: input.remote_bot_id
    });

    const session: RemoteGameSession = {
      sessionId: newGameId(),
      baseUrl: this.normalizeBaseUrl(input.base_url),
      remoteGameId: remoteState.game_id,
      localBotId: input.local_bot_id,
      ourPlayerIndex: input.our_player_index ?? 0,
      status: remoteState.status,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastKnownState: remoteState
    };

    remoteGameSessionsStore.save(session);

    return this.toDto(session);
  }

  getRemoteGameSession(sessionId: string): RemoteGameSessionDto {
    if (!sessionId || sessionId.trim() === "") {
      throw new Error("sessionId is required");
    }

    const session = remoteGameSessionsStore.getOrThrow(sessionId);
    return this.toDto(session);
  }

  async playRemoteTurn(sessionId: string): Promise<RemotePlayTurnResponseDto> {
    if (!sessionId || sessionId.trim() === "") {
      throw new Error("sessionId is required");
    }

    const session = remoteGameSessionsStore.getOrThrow(sessionId);

    const currentRemoteState = await remoteInteropClient.getGame(
      session.baseUrl,
      session.remoteGameId
    );

    if (currentRemoteState.status !== "ONGOING") {
      const updatedSession: RemoteGameSession = {
        ...session,
        status: currentRemoteState.status,
        lastKnownState: currentRemoteState,
        updatedAt: new Date().toISOString()
      };

      remoteGameSessionsStore.save(updatedSession);

      return {
        action: "GAME_FINISHED",
        session: this.toDto(updatedSession)
      };
    }

    if (currentRemoteState.position.turn !== session.ourPlayerIndex) {
      const updatedSession: RemoteGameSession = {
        ...session,
        status: currentRemoteState.status,
        lastKnownState: currentRemoteState,
        updatedAt: new Date().toISOString()
      };

      remoteGameSessionsStore.save(updatedSession);

      return {
        action: "WAITING_OPPONENT",
        session: this.toDto(updatedSession)
      };
    }

    const move = await gameyClient.chooseBotMove(
      session.localBotId,
      currentRemoteState.position
    );

    const proposedPosition = applyMoveToYen(
      currentRemoteState.position,
      move.coords
    );

    const updatedRemoteState = await remoteInteropClient.playMove(
      session.baseUrl,
      session.remoteGameId,
      proposedPosition
    );

    const updatedSession: RemoteGameSession = {
      ...session,
      status: updatedRemoteState.status,
      lastKnownState: updatedRemoteState,
      updatedAt: new Date().toISOString()
    };

    remoteGameSessionsStore.save(updatedSession);

    return {
      action: "MOVE_SUBMITTED",
      move: move.coords,
      session: this.toDto(updatedSession)
    };
  }

  private toDto(session: RemoteGameSession): RemoteGameSessionDto {
    return {
      session_id: session.sessionId,
      base_url: session.baseUrl,
      remote_game_id: session.remoteGameId,
      local_bot_id: session.localBotId,
      our_player_index: session.ourPlayerIndex,
      status: session.status,
      created_at: session.createdAt,
      updated_at: session.updatedAt,
      last_known_state: session.lastKnownState
    };
  }

  private validateConnectInput(input: RemoteConnectRequestDto): void {
    if (!input) {
      throw new Error("request body is required");
    }

    if (!input.base_url || input.base_url.trim() === "") {
      throw new Error("base_url is required");
    }

    if (!input.game_id || input.game_id.trim() === "") {
      throw new Error("game_id is required");
    }

    if (!input.local_bot_id || input.local_bot_id.trim() === "") {
      throw new Error("local_bot_id is required");
    }

    if (
      !Number.isInteger(input.our_player_index) ||
      input.our_player_index < 0
    ) {
      throw new Error("our_player_index must be a non-negative integer");
    }
  }

  private validateCreateInput(input: RemoteCreateRequestDto): void {
    if (!input) {
      throw new Error("request body is required");
    }

    if (!input.base_url || input.base_url.trim() === "") {
      throw new Error("base_url is required");
    }

    if (!Number.isInteger(input.size) || input.size < 1) {
      throw new Error("size must be a positive integer");
    }

    if (!input.remote_bot_id || input.remote_bot_id.trim() === "") {
      throw new Error("remote_bot_id is required");
    }

    if (!input.local_bot_id || input.local_bot_id.trim() === "") {
      throw new Error("local_bot_id is required");
    }

    if (
      input.our_player_index !== undefined &&
      (!Number.isInteger(input.our_player_index) || input.our_player_index < 0)
    ) {
      throw new Error("our_player_index must be a non-negative integer");
    }
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
  }
}

export const remoteInteropService = new RemoteInteropService();