
const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();
require('./db');

// IMPORT MODELS
const User = require('./models/User');
const GameResult = require('./models/GameResult');

// CONFIGURATION
const app = express();
app.use(express.json()); // set up with json

const PORT = process.env.PORT || 3000; // use port from env or 3000 by default


// =============================   USERS ENDPOINTS    ============================================

/**
 * POST /createuser
 * Saves NEW USER in the db
 */
app.post('/createuser', async (req, res) => {
    try {
        const { username, email } = req.body;

        // Validación básica
        if (!username || !email) {
            return res.status(400).json({
                success: false,
                error: 'Username is a mandatory field'
            });
        }

        // new user model
        const newUser = new User({ username, email });

        // save the user in db
        const savedUser = await newUser.save();
        // check message
        res.status(201).json({
            success: true,
            message: `User ${savedUser.username} created`,
            user: {
                id: savedUser._id,
                username: savedUser.username,
                email: savedUser.email,
                createdAt: savedUser.createdAt
            }
        });

    } catch (error) {
        // ERROR : duplicated field (code 11000 in MongoDB)
        if (error.code === 11000) {
            // Check the duplicated field
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                error: `The ${field} field is already in the data base`
            });
        }

        // ERROR : validation
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                error: errors.join(', ')
            });
        }

        // ERROR : generic error
        console.error('Error en POST /createuser:', error);
        res.status(500).json({
            success: false,
            error: 'Internal sevrer error'
        });
    }
});

/**
 * GET /users
 * Gets ALL users from the db
 */
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}).sort({ createdAt: -1 });
        res.json({
            success: true,
            count: users.length,
            users: users
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});


// =========================   GAME RESULTS ENDPOINTS   =====================

/**
 * POST /gameresult
 * SAVE RESULT from a game into the db
 */
app.post('/gameresult', async (req, res) => {
    try {
        const { username, opponent, result, score } = req.body;

        // validation of mandatory field s
        if (!username || !opponent || !result) {
            return res.status(400).json({
                success: false,
                error: 'The are absent field/s : username, opponent, result are mandatory'
            });
        }

        // user existance verification
        const userExists = await User.findOne({ username });
        if (!userExists) {
            return res.status(404).json({
                success: false,
                error: `The user ${username} does not exist`
            });
        }

        // Save game results
        const game = new GameResult({
            username,
            opponent,
            result,
            score: score || 0
        });

        const savedGame = await game.save();

        res.status(201).json({
            success: true,
            message: 'Game result saved',
            game: savedGame
        });

    } catch (error) {
        console.error('Error in POST /gameresult:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /history/:username
 * Obtain the history of games from a user
 */
app.get('/history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 20 } = req.query; // By defect 20 games (Can be changed)

        const history = await GameResult.find({ username })
            .sort({ date: -1 }) // Order : from today to the past
            .limit(parseInt(limit));

        // Stats
        const stats = {
            wins: history.filter(g => g.result === 'win').length,
            losses: history.filter(g => g.result === 'loss').length,
        };

        res.json({
            success: true,
            username,
            stats,
            total: history.length,
            games: history
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /ranking
 * Ranking of players by won games
 */
app.get('/ranking', async (req, res) => {
    try {
        const ranking = await GameResult.aggregate([
            { $match: { result: 'win' } }, // Only won games
            { $group: {
                    _id: '$username',
                    wins: { $sum: 1 },
                    lastGame: { $max: '$date' }
                }},
            { $sort: { wins: -1 } }, // Most wins first
            { $limit: 10 },
            { $project: {
                    username: '$_id',
                    wins: 1,
                    lastGame: 1,
                    _id: 0
                }}
        ]);

        res.json({
            success: true,
            ranking
        });

    } catch (error) {
        console.error('Error in GET /ranking:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /health
 * Endpoint to check if all is okay
 */
app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];

    res.json({
        status: 'OK',
        server: 'running',
        database: states[dbState],
        timestamp: new Date()
    });
});

module.exports = app;


// =============================== START THE SERVER   ======================================

if (require.main === module) {
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`🚀 Servidor corriendo en http://localhost:${PORT}`);
        console.log(`📡 Endpoints disponibles:`);
        console.log(`   POST   /createuser`);
        console.log(`   GET    /users`);
        console.log(`   POST   /gameresult`);
        console.log(`   GET    /history/:username`);
        console.log(`   GET    /ranking`);
        console.log(`   GET    /health`);
    });
}

// Handeling for not cactched errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});