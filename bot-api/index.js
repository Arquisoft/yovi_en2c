import express from "express";
import axios from "axios";
import cors from "cors";

const app = express();
app.use(cors());

const GAMEY_URL = process.env.GAMEY_URL || "http://gamey:4000";

/* --------------------------------------------------
   BOT CALLING LAYER (local + remote)
-------------------------------------------------- */

async function callBot(bot, position) {
    // remote bot (other universities)
    if (bot.startsWith("http")) {
        const res = await axios.get(`${bot}/play`, {
            params: {
                position: JSON.stringify(position)
            }
        });

        return normalizeResponse(res.data);
    }

    // local bot (Gamey registry)
    const res = await axios.get(`${GAMEY_URL}/play`, {
        params: {
            position: JSON.stringify(position),
            bot_id: bot
        }
    });

    return normalizeResponse(res.data);
}

function normalizeResponse(data) {
    // supports both:
    // { coords: {...} } OR { x, y, z }
    if (data.coords) return data.coords;
    return data;
}

/* --------------------------------------------------
   COMPETITION ENDPOINT
-------------------------------------------------- */

app.get("/play", async (req, res) => {
    try {
        if (!req.query.position) {
            return res.status(400).json({ error: "Missing position" });
        }

        const position = JSON.parse(req.query.position);
        const botId = req.query.bot_id || "default";

        const result = await callBot(botId, position);

        return res.json(result);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: "bot failed" });
    }
});

/* --------------------------------------------------
   DEBUG ENDPOINTS
-------------------------------------------------- */

app.get("/bots", async (req, res) => {
    try {
        const response = await axios.get(`${GAMEY_URL}/v1/ybot/info`);
        res.json(response.data);
    } catch {
        res.json({ bots: [] });
    }
});

/* --------------------------------------------------
   SERVER
-------------------------------------------------- */

app.listen(6000, () => {
    console.log("Bot API running on port 6000");
});