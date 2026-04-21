"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
function required(name, fallback) {
    const value = process.env[name] ?? fallback;
    if (!value) {
        throw new Error(`Missing environment variable: ${name}`);
    }
    return value;
}
exports.env = {
    port: Number(required("PORT", "4001")),
    gameyBaseUrl: required("GAMEY_BASE_URL", "http://localhost:4000"),
    gameyApiVersion: required("GAMEY_API_VERSION", "v1")
};
