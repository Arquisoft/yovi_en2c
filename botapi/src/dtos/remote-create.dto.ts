export interface RemoteCreateRequestDto {
  base_url: string;
  size: number;
  remote_bot_id: string;
  local_bot_id: string;
  our_player_index?: number;
}