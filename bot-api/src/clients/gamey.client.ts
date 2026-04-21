import axios from "axios";

const BASE_URL = process.env.GAMEY_BASE_URL|| "http://gamey:4000";

class GameyClient {
    async chooseBotMove(botId: string, yen: any) {
        const res = await axios.post(
            `${BASE_URL}/v1/ybot/choose/${botId}`,
            yen
        );

        return res.data;
    }
}

export const gameyClient = new GameyClient();