import { CoordinatesDto, YenDto } from "./yen.dto";

export interface PlayOnceRequestDto {
  position: YenDto;
  bot_id?: string;
}

export interface PlayOnceResponseDto {
  coords: CoordinatesDto;
}