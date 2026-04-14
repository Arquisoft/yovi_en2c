"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const health_routes_1 = require("./routes/health.routes");
const games_routes_1 = require("./routes/games.routes");
const play_routes_1 = require("./routes/play.routes");
const remote_games_routes_1 = require("./routes/remote-games.routes");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)());
    app.use(express_1.default.json());
    app.use("/health", health_routes_1.healthRoutes);
    app.use("/games", games_routes_1.gamesRoutes);
    app.use("/play", play_routes_1.playRoutes);
    app.use("/remote-games", remote_games_routes_1.remoteGamesRoutes);
    app.use((_req, res) => {
        const error = {
            code: "NOT_FOUND",
            message: "Route not found"
        };
        res.status(404).json(error);
    });
    app.use((err, _req, res, _next) => {
        console.error("[api] unhandled error:", err);
        const error = {
            code: "INTERNAL_ERROR",
            message: err instanceof Error ? err.message : "Unexpected error"
        };
        res.status(500).json(error);
    });
    return app;
}
