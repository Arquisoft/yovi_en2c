"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playController = void 0;
const interop_service_1 = require("../services/interop.service");
class PlayController {
    async playOnce(req, res) {
        try {
            const rawPosition = req.query.position;
            const rawBotId = req.query.bot_id;
            if (typeof rawPosition !== "string" || rawPosition.trim() === "") {
                throw new Error("position query parameter is required");
            }
            let parsedPosition;
            try {
                parsedPosition = JSON.parse(rawPosition);
            }
            catch {
                throw new Error("position must be a valid JSON-encoded YEN object");
            }
            const input = {
                position: parsedPosition,
                bot_id: typeof rawBotId === "string" ? rawBotId : undefined
            };
            const result = await interop_service_1.interopService.playOnce(input);
            res.status(200).json(result);
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error("Unexpected error");
            const body = {
                code: "BAD_REQUEST",
                message: err.message
            };
            res.status(400).json(body);
        }
    }
}
exports.playController = new PlayController();
