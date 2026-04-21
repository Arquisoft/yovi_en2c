"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.gamesController = void 0;
const interop_service_1 = require("../services/interop.service");
class GamesController {
    constructor() {
        this.createGame = this.createGame.bind(this);
        this.getGame = this.getGame.bind(this);
        this.playGame = this.playGame.bind(this);
    }
    async createGame(req, res) {
        try {
            const body = req.body;
            const result = await interop_service_1.interopService.createGame(body);
            res.status(201).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    async getGame(req, res) {
        try {
            const { gameId } = req.params;
            const result = interop_service_1.interopService.getGame(gameId);
            res.status(200).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    async playGame(req, res) {
        try {
            const { gameId } = req.params;
            const body = req.body;
            const result = await interop_service_1.interopService.playGame(gameId, body);
            res.status(200).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    handleError(error, res) {
        const err = error instanceof Error ? error : new Error("Unexpected error");
        const status = this.inferStatus(err.message);
        const body = {
            code: status === 404 ? "NOT_FOUND" : "BAD_REQUEST",
            message: err.message
        };
        res.status(status).json(body);
    }
    inferStatus(message) {
        if (message.includes("not found")) {
            return 404;
        }
        return 400;
    }
}
exports.gamesController = new GamesController();
