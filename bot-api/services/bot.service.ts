import axios from "axios";
import { gameyClient } from "../clients/gamey.client";

class BotService {
    async getMove(botId: string | undefined, yen: any) {
        if (!botId) botId = "default";

        // 🌍 Remote bot
        if (botId.startsWith("http")) {
            const res = await axios.get(`${botId}/play`, {
                params: { position: JSON.stringify(yen) }
            });

            return res.data.coords;
        }

        // 🧠 Local bot (Gamey)
        const res = await gameyClient.chooseBotMove(botId, yen);
        return res.coords;
    }
}

export const botService = new BotService();