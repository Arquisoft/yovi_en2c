"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gameyClient = void 0;
const env_1 = require("../config/env");
class GameyClient {
    async createInitialGame(size) {
        const response = await fetch(`${env_1.env.gameyBaseUrl}/game/new`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({ size })
        });
        return this.handleJsonResponse(response);
    }
    async chooseBotMove(botId, yen) {
        const response = await fetch(`${env_1.env.gameyBaseUrl}/${env_1.env.gameyApiVersion}/ybot/choose/${encodeURIComponent(botId)}`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(yen)
        });
        return this.handleJsonResponse(response);
    }
    async playAgainstBot(botId, yen, row, col) {
        const response = await fetch(`${env_1.env.gameyBaseUrl}/${env_1.env.gameyApiVersion}/game/pvb/${encodeURIComponent(botId)}`, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                yen,
                row,
                col
            })
        });
        return this.handleJsonResponse(response);
    }
    async handleJsonResponse(response) {
        const raw = await response.text();
        const data = raw ? JSON.parse(raw) : null;
        if (!response.ok) {
            const error = data;
            throw new Error(error?.message ?? `gamey request failed with status ${response.status}`);
        }
        return data;
    }
}
exports.gameyClient = new GameyClient();
