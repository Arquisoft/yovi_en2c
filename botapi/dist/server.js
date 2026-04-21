"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const app_1 = require("./app");
const env_1 = require("./config/env");
const app = (0, app_1.createApp)();
app.listen(env_1.env.port, () => {
    console.log(`[api] listening on http://0.0.0.0:${env_1.env.port}`);
    console.log(`[api] using gamey at ${env_1.env.gameyBaseUrl}`);
});
