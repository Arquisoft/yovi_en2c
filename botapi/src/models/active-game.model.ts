import { YenDto } from "../dtos/yen.dto";

export type InteropStatus =
  | "ONGOING"
  | "BOT_WON"
  | "OPPONENT_WON"
  | "DRAW";

export interface ActiveGame {
  gameId: string;
  botId: string;
  yen: YenDto;
  status: InteropStatus;
  createdAt: string;
  updatedAt: string;
}