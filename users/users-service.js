const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const promBundle = require('express-prom-bundle');
require('dotenv').config();
require('./db');

// IMPORT MODELS
const User = require('./models/User');
const GameResult = require('./models/GameResult');

// CONFIGURATION
const app = express();
app.use(express.json());

// PROMETHEUS METRICS MIDDLEWARE
const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    normalizePath: [
        ['^/users/.*', '/users/:username'],
        ['^/history/.*', '/history/:username'],
        ['^/stats/.*', '/stats/:username'],
        ['^/profile/.*', '/profile/:username'],
        ['^/friends/.*', '/friends/:username'],
    ],
});
app.use(metricsMiddleware);

const PORT = process.env.PORT || 3000;
const SALT_ROUNDS = 10;

// ── JWT helper ────────────────────────────────────────────────────────────────

function getUsernameFromToken(authHeader) {
    if (!authHeader?.startsWith('Bearer ')) return null;
    try {
        const payload = authHeader.split('.')[1];
        const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
        return decoded.username ?? decoded.sub ?? null;
    } catch {
        return null;
    }
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

function normalizeUsername(value) {
    if (typeof value !== 'string') return null;

    const username = value.trim();
    if (!username) return null;

    const usernameRegex = /^[A-Za-z0-9_]{1,30}$/;
    if (!usernameRegex.test(username)) return null;

    return username;
}

function normalizeLooseUsername(value) {
    if (typeof value !== 'string') return null;

    const username = value.trim();
    return username || null;
}

function normalizeEmail(value) {
    if (value === undefined || value === null) return undefined;
    if (typeof value !== 'string') return undefined;

    const email = value.trim();
    return email === '' ? undefined : email;
}

function normalizeSearchText(value, maxLength = 50) {
    if (typeof value !== 'string') return null;

    const text = value.trim();
    if (!text) return null;
    if (text.length > maxLength) return null;

    return text;
}

function escapeRegex(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parsePositiveInt(value, fallback) {
    const parsed = Number.parseInt(value, 10);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

async function findUserByUsername(username) {
    return User.findOne({ username });
}

async function ensureExistingUser(username) {
    const user = await findUserByUsername(username);
    return user || null;
}

function publicGameView(game) {
    return {
        opponent: game.opponent,
        result: game.result,
        boardSize: game.boardSize,
        gameMode: game.gameMode,
        date: game.date,
    };
}

function buildWinLossStats(games) {
    return {
        wins: games.filter(g => g.result === 'win').length,
        losses: games.filter(g => g.result === 'loss').length,
    };
}

function formatCreateUserValidationErrors(error) {
    const messages = Object.values(error.errors || {})
        .map(e => e?.message)
        .filter(Boolean);

    const customOrder = [
        'Email is invalid',
        'Username is invalid',
        'Username is a mandatory field'
    ];

    const ordered = [
        ...customOrder.filter(msg => messages.includes(msg)),
        ...messages.filter(msg => !customOrder.includes(msg))
    ];

    return ordered.join(', ');
}

// =============================   USERS ENDPOINTS    ============================================

app.post('/createuser', async (req, res) => {
    try {
        const rawUsername = req.body?.username;
        const { password } = req.body;
        const processedEmail = normalizeEmail(req.body?.email);

        const username =
            typeof rawUsername === 'string'
                ? rawUsername.trim()
                : '';

        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is a mandatory field' });
        }

        if (password === undefined || password === null) {
            return res.status(400).json({ success: false, error: 'Password is a mandatory field' });
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = new User({
            username,
            email: processedEmail,
            password: hashedPassword
        });

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
            const field = Object.keys(error.keyPattern || {})[0] || 'field';
            return res.status(400).json({
                success: false,
                error: `The ${field} field is already in the data base`
            });
        }

        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors || {}).map(e => e.message);
            return res.status(400).json({ success: false, error: errors.join(', ') });
        }

        console.error('Error en POST /createuser:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/users/:username', async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);

        if (!username) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const user = await findUserByUsername(username);

        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
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
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/users', async (_req, res) => {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/search', async (req, res) => {
    try {
        const safeQuery = normalizeSearchText(req.query.q);

        if (!safeQuery) {
            return res.status(400).json({ success: false, error: 'Query parameter q is required' });
        }

        const escaped = escapeRegex(safeQuery);
        const regex = new RegExp(escaped, 'i');

        const users = await User.find(
            { $or: [{ username: regex }, { email: regex }] },
            { password: 0, friendRequests: 0 }
        ).limit(20);

        res.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                username: u.username,
                email: u.email ?? null,
                realName: u.realName ?? null,
            }))
        });

    } catch (error) {
        console.error('Error in GET /search:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// =========================   GAME RESULTS ENDPOINTS   =====================

app.post('/gameresult', async (req, res) => {
    try {
        const username = normalizeLooseUsername(req.body?.username);
        const opponent = normalizeLooseUsername(req.body?.opponent);
        const { result, score, winner, boardSize, gameMode } = req.body;

        if (!username || !opponent || !result) {
            return res.status(400).json({
                success: false,
                error: 'The are absent field/s : username, opponent, result are mandatory'
            });
        }

        const userExists = await ensureExistingUser(username);
        if (!userExists) {
            return res.status(404).json({ success: false, error: `The user ${username} does not exist` });
        }

        const normalizedWinner = winner ? normalizeLooseUsername(winner) : null;

        const game = new GameResult({
            username,
            opponent,
            result,
            winner: normalizedWinner,
            score: score || 0,
            boardSize: boardSize || 7,
            gameMode: gameMode || 'pvb'
        });

        const savedGame = await game.save();
        res.status(201).json({ success: true, message: 'Game result saved', game: savedGame });

    } catch (error) {
        console.error('Error in POST /gameresult:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.post('/gameresult/multiplayer', async (req, res) => {
    try {
        const player1 = normalizeUsername(req.body?.player1);
        const player2 = normalizeUsername(req.body?.player2);
        const winner = normalizeUsername(req.body?.winner);
        const { boardSize } = req.body;

        if (!player1 || !player2 || !winner) {
            return res.status(400).json({
                success: false,
                error: 'player1, player2 and winner are mandatory'
            });
        }

        if (player1 === player2) {
            return res.status(400).json({
                success: false,
                error: 'player1 and player2 must be different users'
            });
        }

        if (winner !== player1 && winner !== player2) {
            return res.status(400).json({
                success: false,
                error: 'winner must be one of the two players'
            });
        }

        const [user1Exists, user2Exists] = await Promise.all([
            ensureExistingUser(player1),
            ensureExistingUser(player2)
        ]);

        if (!user1Exists) {
            return res.status(404).json({
                success: false,
                error: `The user ${player1} does not exist`
            });
        }

        if (!user2Exists) {
            return res.status(404).json({
                success: false,
                error: `The user ${player2} does not exist`
            });
        }

        const normalizedBoardSize = Number.isInteger(boardSize) && boardSize > 0 ? boardSize : 7;

        const player1Won = winner === player1;
        const player2Won = winner === player2;

        const results = await GameResult.insertMany([
            {
                username: player1,
                opponent: player2,
                result: player1Won ? 'win' : 'loss',
                winner,
                score: player1Won ? normalizedBoardSize : 0,
                boardSize: normalizedBoardSize,
                gameMode: 'pvp'
            },
            {
                username: player2,
                opponent: player1,
                result: player2Won ? 'win' : 'loss',
                winner,
                score: player2Won ? normalizedBoardSize : 0,
                boardSize: normalizedBoardSize,
                gameMode: 'pvp'
            }
        ]);

        return res.status(201).json({
            success: true,
            message: 'Multiplayer game result saved',
            games: results
        });

    } catch (error) {
        console.error('Error in POST /gameresult/multiplayer:', error);
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

app.get('/history/:username', async (req, res) => {
    try {
        const username = normalizeLooseUsername(req.params.username);
        const limit = parsePositiveInt(req.query.limit, 20);

        if (!username) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const games = await GameResult.find({ username })
            .sort({ date: -1 })
            .limit(limit);

        const stats = buildWinLossStats(games);

        res.json({ success: true, username, stats, total: games.length, games });
    } catch (error) {
        console.error('Error in GET /history/:username:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/ranking', async (_req, res) => {
    try {
        const ranking = await GameResult.aggregate([
            { $match: { result: 'win' } },
            { $group: { _id: '$username', wins: { $sum: 1 }, lastGame: { $max: '$date' } } },
            { $sort: { wins: -1 } },
            { $limit: 10 },
            { $project: { username: '$_id', wins: 1, lastGame: 1, _id: 0 } }
        ]);
        res.json({ success: true, ranking });
    } catch (error) {
        console.error('Error in GET /ranking:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/stats/:username', async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);
        const page = Math.max(1, parsePositiveInt(req.query.page, 1));
        const pageSize = Math.max(1, parsePositiveInt(req.query.pageSize, 10));

        if (!username) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const userExists = await ensureExistingUser(username);
        if (!userExists) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        const games = await GameResult.find({ username }).sort({ date: -1 });
        const totalGames = games.length;
        const wins = games.filter(g => g.result === 'win').length;
        const losses = games.filter(g => g.result === 'loss').length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const pvbGames = games.filter(g => g.gameMode === 'pvb');
        const pvpGames = games.filter(g => g.gameMode === 'pvp');

        const start = (page - 1) * pageSize;
        const paginatedGames = games.slice(start, start + pageSize).map(publicGameView);
        const lastFive = games.slice(0, 5).map(publicGameView);

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
                lastFive
            },
            games: paginatedGames,
            page,
            pageSize,
        });

    } catch (error) {
        console.error('Error in GET /stats/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/profile/:username', async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);

        if (!username) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const user = await User.findOne({ username }, { password: 0 });
        if (!user) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        const games = await GameResult.find({ username }).sort({ date: -1 });
        const totalGames = games.length;
        const wins = games.filter(g => g.result === 'win').length;
        const losses = games.filter(g => g.result === 'loss').length;
        const winRate = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const recentMatches = games.slice(0, 5).map(publicGameView);

        res.json({
            success: true,
            profile: {
                username: user.username,
                realName: user.realName ?? null,
                bio: user.bio ?? null,
                location: user.location ?? {},
                preferredLanguage: user.preferredLanguage ?? 'en',
                joinDate: user.createdAt,
                stats: { totalGames, wins, losses, winRate },
                recentMatches,
                friends: user.friends ?? [],
                friendRequests: user.friendRequests ?? [],
            }
        });

    } catch (error) {
        console.error('Error in GET /profile/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.patch('/profile/:username', async (req, res) => {
    try {
        const username = normalizeUsername(req.params.username);

        if (!username) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const { realName, bio, city, country, preferredLanguage } = req.body;

        const user = await findUserByUsername(username);
        if (!user) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        if (realName !== undefined) user.realName = realName;
        if (bio !== undefined) user.bio = bio;
        if (city !== undefined) user.location = { ...user.location, city };
        if (country !== undefined) user.location = { ...user.location, country };
        if (preferredLanguage !== undefined) user.preferredLanguage = preferredLanguage;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated',
            profile: {
                username: user.username,
                realName: user.realName ?? null,
                bio: user.bio ?? null,
                location: user.location ?? {},
                preferredLanguage: user.preferredLanguage
            }
        });

    } catch (error) {
        if (error.name === 'ValidationError') {
            const errors = Object.values(error.errors).map(e => e.message);
            return res.status(400).json({ success: false, error: errors.join(', ') });
        }
        console.error('Error in PATCH /profile/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// =========================   FRIENDS ENDPOINTS   ===========================

app.post('/friends/request/:username', async (req, res) => {
    try {
        const targetUsername = normalizeUsername(req.params.username);
        const senderUsername = normalizeUsername(getUsernameFromToken(req.headers.authorization));

        if (!senderUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!targetUsername) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        if (senderUsername === targetUsername) {
            return res.status(400).json({ success: false, error: 'You cannot send a friend request to yourself' });
        }

        const target = await findUserByUsername(targetUsername);
        if (!target) {
            return res.status(404).json({ success: false, error: `User ${targetUsername} not found` });
        }

        if (target.friends.includes(senderUsername)) {
            return res.status(409).json({ success: false, error: 'You are already friends' });
        }

        if (target.friendRequests.includes(senderUsername)) {
            return res.status(409).json({ success: false, error: 'Friend request already sent' });
        }

        target.friendRequests.push(senderUsername);
        await target.save();

        res.status(201).json({ success: true, message: `Friend request sent to ${targetUsername}` });

    } catch (error) {
        console.error('Error in POST /friends/request/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/friends/accept/:username', async (req, res) => {
    try {
        const senderUsername = normalizeUsername(req.params.username);
        const acceptorUsername = normalizeUsername(getUsernameFromToken(req.headers.authorization));

        if (!acceptorUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!senderUsername) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const acceptor = await findUserByUsername(acceptorUsername);
        if (!acceptor) {
            return res.status(404).json({ success: false, error: 'Acceptor user not found' });
        }

        if (!acceptor.friendRequests.includes(senderUsername)) {
            return res.status(404).json({ success: false, error: 'No pending request from that user' });
        }

        const sender = await findUserByUsername(senderUsername);
        if (!sender) {
            return res.status(404).json({ success: false, error: `User ${senderUsername} not found` });
        }

        acceptor.friendRequests = acceptor.friendRequests.filter(u => u !== senderUsername);
        if (!acceptor.friends.includes(senderUsername)) acceptor.friends.push(senderUsername);
        if (!sender.friends.includes(acceptorUsername)) sender.friends.push(acceptorUsername);

        await acceptor.save();
        await sender.save();

        res.json({ success: true, message: `You are now friends with ${senderUsername}` });

    } catch (error) {
        console.error('Error in POST /friends/accept/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.delete('/friends/:username', async (req, res) => {
    try {
        const targetUsername = normalizeUsername(req.params.username);
        const currentUsername = normalizeUsername(getUsernameFromToken(req.headers.authorization));

        if (!currentUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        if (!targetUsername) {
            return res.status(400).json({ success: false, error: 'Invalid username' });
        }

        const current = await findUserByUsername(currentUsername);
        const target = await findUserByUsername(targetUsername);

        if (!current || !target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        current.friends = current.friends.filter(u => u !== targetUsername);
        target.friends = target.friends.filter(u => u !== currentUsername);

        await current.save();
        await target.save();

        res.json({ success: true, message: `${targetUsername} removed from your friends` });

    } catch (error) {
        console.error('Error in DELETE /friends/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/friends', async (req, res) => {
    try {
        const currentUsername = normalizeUsername(getUsernameFromToken(req.headers.authorization));

        if (!currentUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const user = await User.findOne({ username: currentUsername }, { friends: 1 });
        if (!user) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        res.json({ success: true, friends: user.friends });

    } catch (error) {
        console.error('Error in GET /friends:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', async (_req, res) => {
    const dbState = mongoose.connection.readyState;
    const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
    res.json({ status: 'OK', server: 'running', database: states[dbState], timestamp: new Date() });
});

module.exports = app;

// =============================== START THE SERVER ================================

if (require.main == module) {
    app.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

process.on('unhandledRejection', (error) => {
    console.error('❌ Unhandled Rejection:', error);
});