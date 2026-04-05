import { CoordinatesDto, YenDto } from "./yen.dto";

export interface PlayOnceRequestDto {
  position: YenDto;
  bot_id: string;
}

export interface PlayOnceResponseDto {
  bot_id: string;
  move: CoordinatesDto;
  position: YenDto;
  status: "ONGOING" | "BOT_WON" | "OPPONENT_WON" | "DRAW";
}