import { Router } from "express";
import { remoteGamesController } from "../controllers/remote-games.controller";

export const remoteGamesRoutes = Router();

remoteGamesRoutes.post("/connect", remoteGamesController.connectToRemoteGame);
remoteGamesRoutes.post("/create", remoteGamesController.createRemoteGame);
remoteGamesRoutes.get("/:sessionId", remoteGamesController.getRemoteGameSession);
remoteGamesRoutes.post("/:sessionId/play-turn", remoteGamesController.playRemoteTurn);