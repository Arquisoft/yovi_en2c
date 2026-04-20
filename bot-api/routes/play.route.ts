import { Router } from "express";
import { playController } from "../controllers/play.controller";

const router = Router();

router.get("/", playController.playOnce);

export default router;