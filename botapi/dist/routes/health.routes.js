"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthRoutes = void 0;
const express_1 = require("express");
const health_controller_1 = require("../controllers/health.controller");
exports.healthRoutes = (0, express_1.Router)();
exports.healthRoutes.get("/", health_controller_1.healthController.healthCheck);
