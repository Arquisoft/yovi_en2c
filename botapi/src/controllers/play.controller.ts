import { Request, Response } from "express";
import { interopService } from "../services/interop.service";
import { PlayOnceRequestDto } from "../dtos/play-once.dto";
import { ErrorDto } from "../dtos/error.dto";

class PlayController {
  async playOnce(req: Request, res: Response) {
    try {
      const rawPosition = req.query.position;
      const rawBotId = req.query.bot_id;

      if (typeof rawPosition !== "string" || rawPosition.trim() === "") {
        throw new Error("position query parameter is required");
      }

      let parsedPosition: PlayOnceRequestDto["position"];

      try {
        parsedPosition = JSON.parse(rawPosition);
      } catch {
        throw new Error("position must be a valid JSON-encoded YEN object");
      }

      const input: PlayOnceRequestDto = {
        position: parsedPosition,
        bot_id: typeof rawBotId === "string" ? rawBotId : undefined
      };

      const result = await interopService.playOnce(input);
      res.status(200).json(result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Unexpected error");

      const body: ErrorDto = {
        code: "BAD_REQUEST",
        message: err.message
      };

      res.status(400).json(body);
    }
  }
}

export const playController = new PlayController();