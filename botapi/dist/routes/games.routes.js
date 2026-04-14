"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gamesRoutes = void 0;
const express_1 = require("express");
const games_controller_1 = require("../controllers/games.controller");
exports.gamesRoutes = (0, express_1.Router)();
exports.gamesRoutes.post("/", games_controller_1.gamesController.createGame);
exports.gamesRoutes.get("/:gameId", games_controller_1.gamesController.getGame);
exports.gamesRoutes.post("/:gameId/play", games_controller_1.gamesController.playGame);
