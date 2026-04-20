export interface Game {
    id: string;
    botId: string;
    position: any;
    status: "ONGOING" | "FINISHED";
}

export const games = new Map<string, Game>();