import { GameStateDto } from "../dtos/game-state.dto";

export interface RemoteGameSession {
  sessionId: string;
  baseUrl: string;
  remoteGameId: string;
  localBotId: string;
  ourPlayerIndex: number;
  status: "ONGOING" | "BOT_WON" | "OPPONENT_WON" | "DRAW";
  createdAt: string;
  updatedAt: string;
  lastKnownState: GameStateDto | null;
}