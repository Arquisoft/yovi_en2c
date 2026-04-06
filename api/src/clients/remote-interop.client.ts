import { GameStateDto } from "../dtos/game-state.dto";
import { PlayMoveRequestDto } from "../dtos/play-move.dto";
import { CreateGameRequestDto } from "../dtos/create-game.dto";

interface RemoteErrorResponse {
  code?: string;
  message?: string;
}

class RemoteInteropClient {
  async getGame(baseUrl: string, gameId: string): Promise<GameStateDto> {
    const response = await fetch(
      `${this.normalizeBaseUrl(baseUrl)}/games/${encodeURIComponent(gameId)}`
    );

    return this.handleJsonResponse<GameStateDto>(response);
  }

  async playMove(
    baseUrl: string,
    gameId: string,
    position: PlayMoveRequestDto["position"]
  ): Promise<GameStateDto> {
    const response = await fetch(
      `${this.normalizeBaseUrl(baseUrl)}/games/${encodeURIComponent(gameId)}/play`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          position
        })
      }
    );

    return this.handleJsonResponse<GameStateDto>(response);
  }

  async createGame(
    baseUrl: string,
    request: CreateGameRequestDto
  ): Promise<GameStateDto> {
    const response = await fetch(`${this.normalizeBaseUrl(baseUrl)}/games`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify(request)
    });

    return this.handleJsonResponse<GameStateDto>(response);
  }

  private normalizeBaseUrl(baseUrl: string): string {
    return baseUrl.replace(/\/+$/, "");
  }

  private async handleJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const error = data as RemoteErrorResponse | null;
      throw new Error(
        error?.message ?? `remote API request failed with status ${response.status}`
      );
    }

    return data as T;
  }
}

export const remoteInteropClient = new RemoteInteropClient();