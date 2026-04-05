import "dotenv/config";
import { createApp } from "./app";
import { env } from "./config/env";

const app = createApp();

app.listen(env.port, () => {
  console.log(`[api] listening on http://0.0.0.0:${env.port}`);
  console.log(`[api] using gamey at ${env.gameyBaseUrl}`);
});