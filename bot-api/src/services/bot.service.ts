import axios from "axios";
import { gameyClient } from "../clients/gamey.client";

class BotService {
    async getMove(botId: string | undefined, yen: any) {
        const id = botId || "default";

        try {
            // Remote bot
            if (id.startsWith("http")) {
                const res = await axios.get(`${id}/play`, {
                    params: {
                        position: JSON.stringify(yen)
                    }
                });

                return this.normalize(res.data);
            }

            // Local bot
            const res = await gameyClient.chooseBotMove(id, yen);

            return this.normalize(res);
        } catch (err: any) {
            console.error(
                "Bot error:",
                err?.response?.data || err.message
            );
            throw err;
        }
    }

    normalize(data: any) {
        if (!data) throw new Error("Empty bot response");

        if (data.coords) return data.coords;
        if (typeof data.x === "number") return data;

        throw new Error("Invalid bot response: " + JSON.stringify(data));
    }
}

export const botService = new BotService();