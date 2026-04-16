"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteInteropClient = void 0;
class RemoteInteropClient {
    allowedHosts = new Set([
        "localhost:4001",
        "equipo-rival:4001",
        "yovi.13.63.89.84.sslip.io"
    ]);
    async getGame(baseUrl, gameId) {
        const url = this.buildSafeUrl(baseUrl, `/games/${encodeURIComponent(gameId)}`);
        const response = await fetch(url);
        return this.handleJsonResponse(response);
    }
    async playMove(baseUrl, gameId, position) {
        const url = this.buildSafeUrl(baseUrl, `/games/${encodeURIComponent(gameId)}/play`);
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify({
                position
            })
        });
        return this.handleJsonResponse(response);
    }
    async createGame(baseUrl, request) {
        const url = this.buildSafeUrl(baseUrl, "/games");
        const response = await fetch(url, {
            method: "POST",
            headers: {
                "content-type": "application/json"
            },
            body: JSON.stringify(request)
        });
        return this.handleJsonResponse(response);
    }
    buildSafeUrl(baseUrl, path) {
        const parsed = new URL(baseUrl);
        if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
            throw new Error("Invalid remote API protocol");
        }
        if (parsed.username || parsed.password) {
            throw new Error("User info is not allowed in remote API URL");
        }
        if (!this.allowedHosts.has(parsed.host)) {
            throw new Error(`Remote API host not allowed: ${parsed.host}`);
        }
        parsed.pathname = path;
        parsed.search = "";
        parsed.hash = "";
        return parsed.toString();
    }
    async handleJsonResponse(response) {
        const raw = await response.text();
        const data = raw ? JSON.parse(raw) : null;
        if (!response.ok) {
            const error = data;
            throw new Error(error?.message ?? `remote API request failed with status ${response.status}`);
        }
        return data;
    }
}
exports.remoteInteropClient = new RemoteInteropClient();
