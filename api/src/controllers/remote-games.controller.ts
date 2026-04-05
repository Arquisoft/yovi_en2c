import { Request, Response } from "express";
import { remoteInteropService } from "../services/remote-interop.service";
import { RemoteConnectRequestDto } from "../dtos/remote-connect.dto";
import { RemoteCreateRequestDto } from "../dtos/remote-create.dto";
import { ErrorDto } from "../dtos/error.dto";

type SessionParams = {
  sessionId: string;
};

class RemoteGamesController {
  async connectToRemoteGame(
    req: Request<{}, {}, RemoteConnectRequestDto>,
    res: Response
  ) {
    try {
      const result = await remoteInteropService.connectToRemoteGame(req.body);
      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async createRemoteGame(
    req: Request<{}, {}, RemoteCreateRequestDto>,
    res: Response
  ) {
    try {
      const result = await remoteInteropService.createRemoteGame(req.body);
      res.status(201).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async getRemoteGameSession(
    req: Request<SessionParams>,
    res: Response
  ) {
    try {
      const { sessionId } = req.params;
      const result = remoteInteropService.getRemoteGameSession(sessionId);
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  async playRemoteTurn(
    req: Request<SessionParams>,
    res: Response
  ) {
    try {
      const { sessionId } = req.params;
      const result = await remoteInteropService.playRemoteTurn(sessionId);
      res.status(200).json(result);
    } catch (error) {
      this.handleError(error, res);
    }
  }

  private handleError(error: unknown, res: Response) {
    const err = error instanceof Error ? error : new Error("Unexpected error");
    const status = this.inferStatus(err.message);

    const body: ErrorDto = {
      code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
      message: err.message
    };

    res.status(status).json(body);
  }

  private inferStatus(message: string): number {
    if (message.includes("not found")) {
      return 404;
    }

    return 400;
  }
}

export const remoteGamesController = new RemoteGamesController();