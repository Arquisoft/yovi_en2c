"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.remoteGamesController = void 0;
const remote_interop_service_1 = require("../services/remote-interop.service");
class RemoteGamesController {
    async connectToRemoteGame(req, res) {
        try {
            const result = await remote_interop_service_1.remoteInteropService.connectToRemoteGame(req.body);
            res.status(201).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    async createRemoteGame(req, res) {
        try {
            const result = await remote_interop_service_1.remoteInteropService.createRemoteGame(req.body);
            res.status(201).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    async getRemoteGameSession(req, res) {
        try {
            const { sessionId } = req.params;
            const result = remote_interop_service_1.remoteInteropService.getRemoteGameSession(sessionId);
            res.status(200).json(result);
        }
        catch (error) {
            this.handleError(error, res);
        }
    }
    async playRemoteTurn(req, res) {
        try {
            const { sessionId } = req.params;
            const result = await remote_interop_service_1.remoteInteropService.playRemoteTurn(sessionId);
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
exports.remoteGamesController = new RemoteGamesController();
