const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config();
require('./db');

// IMPORT MODELS
const User = require('./models/User');
const GameResult = require('./models/GameResult');

// CONFIGURATION
const app = express();
app.use(express.json()); // set up with json

const PORT = process.env.PORT || 3000; // use port from env or 3000 by default
const SALT_ROUNDS = 10;

// =============================   USERS ENDPOINTS    ============================================

/**
 * POST /createuser
 * Saves NEW USER in the db
 * This endpoint only creates the user.
 * Password business validation belongs to auth-service.
 * It hashes the password before saving it in the db, so the password is never stored in clear text.
 */
app.post('/createuser', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username) {
            return res.status(400).json({
                success: false,
                error: 'Username is a mandatory field'
            });
        }

        if (password === undefined || password === null) {
            return res.status(400).json({
                success: false,
                error: 'Password is a mandatory field'
            });
        }

        let processedEmail = undefined;
        if (email && typeof email === 'string' && email.trim() !== '') {
            processedEmail = email.trim();
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const userData = {
            username: username.toString().trim(),
            email: processedEmail,
            password: hashedPassword
        };

        const newUser = new User(userData);
        const savedUser = await newUser.save();

        res.status(201).json({
            success: true,
            message: `User ${savedUser.username} created`,
            user: {
                id: savedUser._id,
                username: savedUser.username,
                email: savedUser.email || null,
                createdAt: savedUser.createdAt
            }
        });

    } catch (error) {
        if (error.code === 11000) {
            const field = Object.keys(error.keyPattern)[0];
            return res.status(400).json({
                success: false,
                error: `The ${field} field is already in the data base`
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({
                success: false,
                error: errors.join(', ')
            });
        }

        console.error('Error en POST /createuser:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /users/:username
 * Gets one user by username
 */
app.get('/users/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toString() });

        if (!user) {
            return res.status(404).json({
                success: false,
                error: 'User not found'
            });
        }

        res.json({
            success: true,
            user: {
                id: user._id,
                username: user.username,
                email: user.email || null,
                password: user.password,
                createdAt: user.createdAt
            }
        });
    } catch (error) {
        console.error('Error in GET /users/:username:', error);
        res.status(500).json({
            success: false,
            error: 'Internal server error'
        });
    }
});

/**
 * GET /users
 * Gets ALL users from the db
 */
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
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
 *
 */
app.post('/gameresult', async (req, res) => {
    try {
        // ✅ MODIFICADO — Se extraen los nuevos campos del body
        const { username, opponent, result, score, winner, boardSize, gameMode } = req.body;

        // validation of mandatory fields
        if (!username || !opponent || !result) {
            return res.status(400).json({
                success: false,
                error: 'The are absent field/s : username, opponent, result are mandatory'
            });
        }

        // user existance verification
        const userExists = await User.findOne({ username: username.toString() });
        if (!userExists) {
            return res.status(404).json({
                success: false,
                error: `The user ${username} does not exist`
            });
        }

        const game = new GameResult({
            username,
            opponent,
            result,
            winner: winner ?? null,
            score: score || 0,
            boardSize: boardSize || 7,
            gameMode: gameMode || 'pvb'
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

        const history = await GameResult.find({ username : username.toString() })
            .sort({ date: -1 }) // Order : from today to the past
            .limit(Number.parseInt(limit));

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
 * GET /stats/:username
 * Returns aggregated statistics for a given user.
 * Computes metrics from the GameResult collection.
 */
app.get('/stats/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const userExists = await User.findOne({ username: username.toString() });
        if (!userExists) {
            return res.status(404).json({
                success: false,
                error: `User ${username} not found`
            });
        }

        const games = await GameResult.find({ username: username.toString() }).sort({ date: -1 });

        const totalGames = games.length;
        const wins = games.filter(g => g.result === 'win').length;
        const losses = games.filter(g => g.result === 'loss').length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

        const pvbGames = games.filter(g => g.gameMode === 'pvb');
        const pvpGames = games.filter(g => g.gameMode === 'pvp');

        const lastFive = games.slice(0, 5).map(g => ({
            opponent: g.opponent,
            result: g.result,
            boardSize: g.boardSize,
            gameMode: g.gameMode,
            date: g.date,
        }));

        res.json({
            success: true,
            username,
            stats: {
                totalGames,
                wins,
                losses,
                winRate,
                pvbGames: pvbGames.length,
                pvpGames: pvpGames.length,
                lastFive,
            }
        });

    } catch (error) {
        console.error('Error in GET /stats/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
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

if (require.main == module) {
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
        console.log(`   GET    /users/:username`);
    });
}

// Handeling for not catched errors
process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});