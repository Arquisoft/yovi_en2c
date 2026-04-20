import { Request, Response } from "express";
import { botService } from "../services/bot.service";

class PlayController {
    async playOnce(req: Request, res: Response) {
        try {
            const rawPosition = req.query.position;
            const botId = req.query.bot_id as string | undefined;

            if (typeof rawPosition !== "string") {
                return res.status(400).json({ error: "position required" });
            }

            const position = JSON.parse(rawPosition);

            const coords = await botService.getMove(botId, position);

            res.json({ coords });
        } catch (err) {
            res.status(500).json({ error: "play failed" });
        }
    }
}

export const playController = new PlayController();