import { Router } from "express";
import { healthController } from "../controllers/health.controller";

export const healthRoutes = Router();

healthRoutes.get("/", healthController.healthCheck);