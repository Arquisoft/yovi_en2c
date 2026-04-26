"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playController = void 0;
const interop_service_1 = require("../services/interop.service");
function isValidYenPosition(value) {
    if (!value || typeof value !== "object")
        return false;
    const position = value;
    return (typeof position.size === "number" &&
        position.size > 0 &&
        typeof position.turn === "number" &&
        Array.isArray(position.players) &&
        position.players.length >= 2 &&
        position.players.every((player) => typeof player === "string") &&
        typeof position.layout === "string" &&
        position.layout.trim().length > 0);
}
class PlayController {
    async playOnce(req, res) {
        try {
            const rawPosition = req.query.position;
            const rawBotId = req.query.bot_id;
            if (typeof rawPosition !== "string" || rawPosition.trim() === "") {
                return res.status(400).json({
                    code: "BAD_REQUEST",
                    message: "position query parameter is required",
                });
            }
            let parsedPosition;
            try {
                parsedPosition = JSON.parse(rawPosition);
            }
            catch {
                return res.status(400).json({
                    code: "BAD_REQUEST",
                    message: "position must be a valid JSON-encoded YEN object",
                });
            }
            if (!isValidYenPosition(parsedPosition)) {
                return res.status(400).json({
                    code: "BAD_REQUEST",
                    message: "position must be a valid YEN object with size, numeric turn, players and layout",
                });
            }
            const input = {
                position: parsedPosition,
                bot_id: typeof rawBotId === "string" && rawBotId.trim() !== ""
                    ? rawBotId
                    : undefined,
            };
            const result = await interop_service_1.interopService.playOnce(input);
            return res.status(200).json(result);
        }
        catch {
            return res.status(500).json({
                code: "INTERNAL_ERROR",
                message: "Unexpected error while computing bot action",
            });
        }
    }
}
exports.playController = new PlayController();
