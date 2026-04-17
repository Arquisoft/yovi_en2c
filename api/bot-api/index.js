import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(express.json());
app.use(cors());

const GAMEY_URL = process.env.GAMEY_URL || "http://gamey:4000";

async function callBot(bot, yen) {
    if (bot.startsWith("http")) {
        const res = await axios.post(bot, yen);
        return res.data.coords;
    } else {
        const res = await axios.post(
            `${GAMEY_URL}/v1/ybot/choose/${bot}`,
            yen
        );
        return res.data.coords;
    }
}

app.post("/bot/move", async (req, res) => {
    const { bot, yen } = req.body;

    try {
        const coords = await callBot(bot, yen);
        res.json({ success: true, coords });
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ success: false, error: "Bot failed" });
    }
});

app.post("/bot/bvb", async (req, res) => {
    const { yen, bot1, bot2 } = req.body;

    try {
        const move = await callBot(bot1, yen);

        const response = await axios.post(
            `${GAMEY_URL}/v1/game/pvb/${bot2}`,
            {
                yen,
                row: move.x,
                col: move.y
            }
        );

        res.json(response.data);
    } catch (err) {
        console.error(err.message);
        res.status(500).json({ error: "BvB failed" });
    }
});

app.get("/bots", async (req, res) => {
    try {
        const response = await axios.get(`${GAMEY_URL}/v1/ybot/info`);
        res.json(response.data);
    } catch {
        res.json({ bots: [] });
    }
});

app.listen(6000, () => {
    console.log("Bot API running on port 6000");
});