import { Request, Response } from "express";
import { interopService } from "../services/interop.service";
import { PlayOnceRequestDto } from "../dtos/play-once.dto";
import { ErrorDto } from "../dtos/error.dto";

class PlayController {
  async playOnce(req: Request, res: Response) {
    try {
      const body = req.body as PlayOnceRequestDto;
      const result = await interopService.playOnce(body);
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