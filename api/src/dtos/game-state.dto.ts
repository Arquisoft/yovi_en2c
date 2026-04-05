import { YenDto } from "./yen.dto";

export interface GameStateDto {
  game_id: string;
  bot_id: string;
  position: YenDto;
  status: "ONGOING" | "BOT_WON" | "OPPONENT_WON" | "DRAW";
}