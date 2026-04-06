import { GameStateDto } from "../dtos/game-state.dto";
import { PlayMoveRequestDto } from "../dtos/play-move.dto";
import { CreateGameRequestDto } from "../dtos/create-game.dto";

interface RemoteErrorResponse {
  code?: string;
  message?: string;
}

class RemoteInteropClient {
  private readonly allowedHosts = new Set([
    "localhost:4001",
    "equipo-rival:4001",
    "yovi.13.63.89.84.sslip.io"
  ]);

  async getGame(baseUrl: string, gameId: string): Promise<GameStateDto> {
    const url = this.buildSafeUrl(baseUrl, `/games/${encodeURIComponent(gameId)}`);

    const response = await fetch(url);

    return this.handleJsonResponse<GameStateDto>(response);
  }

  async playMove(
    baseUrl: string,
    gameId: string,
    position: PlayMoveRequestDto["position"]
  ): Promise<GameStateDto> {
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

    return this.handleJsonResponse<GameStateDto>(response);
  }

  async createGame(
    baseUrl: string,
    request: CreateGameRequestDto
  ): Promise<GameStateDto> {
    const url = this.buildSafeUrl(baseUrl, "/games");

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    return this.handleJsonResponse<GameStateDto>(response);
  }

  private buildSafeUrl(baseUrl: string, path: string): string {
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

  private async handleJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const error = data as { code?: string; message?: string } | null;
      throw new Error(
        error?.message ?? `remote API request failed with status ${response.status}`
      );
    }

    return data as T;
  }
}

export const remoteInteropClient = new RemoteInteropClient();