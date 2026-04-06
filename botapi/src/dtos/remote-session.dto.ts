import { CoordinatesDto } from "./yen.dto";
import { GameStateDto } from "./game-state.dto";

export interface RemoteGameSessionDto {
  session_id: string;
  base_url: string;
  remote_game_id: string;
  local_bot_id: string;
  our_player_index: number;
  status: "ONGOING" | "BOT_WON" | "OPPONENT_WON" | "DRAW";
  created_at: string;
  updated_at: string;
  last_known_state: GameStateDto | null;
}

export interface RemotePlayTurnResponseDto {
  action: "WAITING_OPPONENT" | "MOVE_SUBMITTED" | "GAME_FINISHED";
  session: RemoteGameSessionDto;
  move?: CoordinatesDto;
}