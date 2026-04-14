"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteInteropService = void 0;
const remote_interop_client_1 = require("../clients/remote-interop.client");
const gamey_client_1 = require("../clients/gamey.client");
const remote_game_sessions_store_1 = require("../store/remote-game-sessions.store");
const ids_1 = require("../utils/ids");
const yen_1 = require("../utils/yen");
class RemoteInteropService {
    async connectToRemoteGame(input) {
        this.validateConnectInput(input);
        const remoteState = await remote_interop_client_1.remoteInteropClient.getGame(input.base_url, input.game_id);
        const session = {
            sessionId: (0, ids_1.newGameId)(),
            baseUrl: this.normalizeBaseUrl(input.base_url),
            remoteGameId: input.game_id,
            localBotId: input.local_bot_id,
            ourPlayerIndex: input.our_player_index,
            status: remoteState.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastKnownState: remoteState
        };
        remote_game_sessions_store_1.remoteGameSessionsStore.save(session);
        return this.toDto(session);
    }
    async createRemoteGame(input) {
        this.validateCreateInput(input);
        const remoteState = await remote_interop_client_1.remoteInteropClient.createGame(input.base_url, {
            size: input.size,
            bot_id: input.remote_bot_id
        });
        const session = {
            sessionId: (0, ids_1.newGameId)(),
            baseUrl: this.normalizeBaseUrl(input.base_url),
            remoteGameId: remoteState.game_id,
            localBotId: input.local_bot_id,
            ourPlayerIndex: input.our_player_index ?? 0,
            status: remoteState.status,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            lastKnownState: remoteState
        };
        remote_game_sessions_store_1.remoteGameSessionsStore.save(session);
        return this.toDto(session);
    }
    getRemoteGameSession(sessionId) {
        if (!sessionId || sessionId.trim() === "") {
            throw new Error("sessionId is required");
        }
        const session = remote_game_sessions_store_1.remoteGameSessionsStore.getOrThrow(sessionId);
        return this.toDto(session);
    }
    async playRemoteTurn(sessionId) {
        if (!sessionId || sessionId.trim() === "") {
            throw new Error("sessionId is required");
        }
        const session = remote_game_sessions_store_1.remoteGameSessionsStore.getOrThrow(sessionId);
        const currentRemoteState = await remote_interop_client_1.remoteInteropClient.getGame(session.baseUrl, session.remoteGameId);
        if (currentRemoteState.status !== "ONGOING") {
            const updatedSession = {
                ...session,
                status: currentRemoteState.status,
                lastKnownState: currentRemoteState,
                updatedAt: new Date().toISOString()
            };
            remote_game_sessions_store_1.remoteGameSessionsStore.save(updatedSession);
            return {
                action: "GAME_FINISHED",
                session: this.toDto(updatedSession)
            };
        }
        if (currentRemoteState.position.turn !== session.ourPlayerIndex) {
            const updatedSession = {
                ...session,
                status: currentRemoteState.status,
                lastKnownState: currentRemoteState,
                updatedAt: new Date().toISOString()
            };
            remote_game_sessions_store_1.remoteGameSessionsStore.save(updatedSession);
            return {
                action: "WAITING_OPPONENT",
                session: this.toDto(updatedSession)
            };
        }
        const move = await gamey_client_1.gameyClient.chooseBotMove(session.localBotId, currentRemoteState.position);
        const proposedPosition = (0, yen_1.applyMoveToYen)(currentRemoteState.position, move.coords);
        const updatedRemoteState = await remote_interop_client_1.remoteInteropClient.playMove(session.baseUrl, session.remoteGameId, proposedPosition);
        const updatedSession = {
            ...session,
            status: updatedRemoteState.status,
            lastKnownState: updatedRemoteState,
            updatedAt: new Date().toISOString()
        };
        remote_game_sessions_store_1.remoteGameSessionsStore.save(updatedSession);
        return {
            action: "MOVE_SUBMITTED",
            move: move.coords,
            session: this.toDto(updatedSession)
        };
    }
    toDto(session) {
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
    validateConnectInput(input) {
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
        if (!Number.isInteger(input.our_player_index) ||
            input.our_player_index < 0) {
            throw new Error("our_player_index must be a non-negative integer");
        }
    }
    validateCreateInput(input) {
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
        if (input.our_player_index !== undefined &&
            (!Number.isInteger(input.our_player_index) || input.our_player_index < 0)) {
            throw new Error("our_player_index must be a non-negative integer");
        }
    }
    normalizeBaseUrl(baseUrl) {
        return baseUrl.replace(/\/+$/, "");
    }
}
exports.remoteInteropService = new RemoteInteropService();
