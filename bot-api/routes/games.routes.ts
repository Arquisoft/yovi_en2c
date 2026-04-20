import { Router } from "express";
import { gamesController } from "../controllers/games.controller";

const router = Router();

router.post("/", gamesController.create);
router.get("/:id", gamesController.get);
router.post("/:id/play", gamesController.play);

export default router;