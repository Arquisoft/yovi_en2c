import { Request, Response } from "express";
import { interopService } from "../services/interop.service";
import { PlayOnceRequestDto } from "../dtos/play-once.dto";
import { ErrorDto } from "../dtos/error.dto";
import { YenDto } from "../dtos/yen.dto";

function isValidYenPosition(value: unknown): value is YenDto {
  if (!value || typeof value !== "object") return false;

  const position = value as Partial<YenDto>;

  return (
    typeof position.size === "number" &&
    position.size > 0 &&
    typeof position.turn === "number" &&
    Array.isArray(position.players) &&
    position.players.length >= 2 &&
    position.players.every((player) => typeof player === "string") &&
    typeof position.layout === "string" &&
    position.layout.trim().length > 0
  );
}

class PlayController {
  async playOnce(req: Request, res: Response) {
    try {
      const rawPosition = req.query.position;
      const rawBotId = req.query.bot_id;

      if (typeof rawPosition !== "string" || rawPosition.trim() === "") {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "position query parameter is required",
        } satisfies ErrorDto);
      }

      let parsedPosition: unknown;

      try {
        parsedPosition = JSON.parse(rawPosition);
      } catch {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "position must be a valid JSON-encoded YEN object",
        } satisfies ErrorDto);
      }

      if (!isValidYenPosition(parsedPosition)) {
        return res.status(400).json({
          code: "BAD_REQUEST",
          message: "position must be a valid YEN object with size, numeric turn, players and layout",
        } satisfies ErrorDto);
      }

      const input: PlayOnceRequestDto = {
        position: parsedPosition,
        bot_id:
          typeof rawBotId === "string" && rawBotId.trim() !== ""
            ? rawBotId
            : undefined,
      };

      const result = await interopService.playOnce(input);
      return res.status(200).json(result);
    } catch {
      return res.status(500).json({
        code: "INTERNAL_ERROR",
        message: "Unexpected error while computing bot action",
      } satisfies ErrorDto);
    }
  }
}

export const playController = new PlayController();