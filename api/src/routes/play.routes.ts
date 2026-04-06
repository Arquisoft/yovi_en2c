import { Router } from "express";
import { playController } from "../controllers/play.controller";

export const playRoutes = Router();

playRoutes.post("/", playController.playOnce);