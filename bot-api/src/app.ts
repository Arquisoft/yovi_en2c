import express from "express";
import playRoutes from "./routes/play.route";
import gamesRoutes from "./routes/games.routes";

const app = express();

app.use(express.json());

app.use("/play", playRoutes);
app.use("/games", gamesRoutes);

app.get("/health", (_, res) => res.send("OK"));

export default app;