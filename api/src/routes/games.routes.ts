import { Router } from "express";
import { gamesController } from "../controllers/games.controller";

export const gamesRoutes = Router();

gamesRoutes.post("/", gamesController.createGame);
gamesRoutes.get("/:gameId", gamesController.getGame);
gamesRoutes.post("/:gameId/play", gamesController.playGame);