import { env } from "../config/env";
import { CoordinatesDto, YenDto } from "../dtos/yen.dto";

interface GameyErrorResponse {
  api_version?: string | null;
  bot_id?: string | null;
  message?: string;
}

interface GameyMoveResponse {
  api_version: string;
  bot_id: string;
  coords: CoordinatesDto;
}

interface GameyPvbResponse {
  yen: YenDto;
  finished: boolean;
  winner: string | null;
  winning_edges: number[][][];
}

class GameyClient {
  async createInitialGame(size: number): Promise<YenDto> {
    const response = await fetch(`${env.gameyBaseUrl}/game/new`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({ size })
    });

    return this.handleJsonResponse<YenDto>(response);
  }

  async chooseBotMove(botId: string, yen: YenDto): Promise<GameyMoveResponse> {
    const response = await fetch(
      `${env.gameyBaseUrl}/${env.gameyApiVersion}/ybot/choose/${encodeURIComponent(botId)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify(yen)
      }
    );

    return this.handleJsonResponse<GameyMoveResponse>(response);
  }

  async playAgainstBot(
    botId: string,
    yen: YenDto,
    row: number,
    col: number
  ): Promise<GameyPvbResponse> {
    const response = await fetch(
      `${env.gameyBaseUrl}/${env.gameyApiVersion}/game/pvb/${encodeURIComponent(botId)}`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          yen,
          row,
          col
        })
      }
    );

    return this.handleJsonResponse<GameyPvbResponse>(response);
  }

  private async handleJsonResponse<T>(response: Response): Promise<T> {
    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!response.ok) {
      const error = data as GameyErrorResponse | null;
      throw new Error(
        error?.message ?? `gamey request failed with status ${response.status}`
      );
    }

    return data as T;
  }
}

export const gameyClient = new GameyClient();