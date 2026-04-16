"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.playRoutes = void 0;
const express_1 = require("express");
const play_controller_1 = require("../controllers/play.controller");
exports.playRoutes = (0, express_1.Router)();
exports.playRoutes.get("/", play_controller_1.playController.playOnce);
