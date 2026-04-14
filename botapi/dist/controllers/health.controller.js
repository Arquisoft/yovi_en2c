"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.healthController = void 0;
class HealthController {
    healthCheck(_req, res) {
        res.status(200).json({ status: "ok" });
    }
}
exports.healthController = new HealthController();
