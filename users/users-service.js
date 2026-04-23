const express = require('express');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const promBundle = require('express-prom-bundle');
require('dotenv').config();
require('./db');

// IMPORT MODELS
const User         = require('./models/User');
const GameResult   = require('./models/GameResult');
const Notification = require('./models/Notification');

// CONFIGURATION
const app = express();
app.use(express.json());

// PROMETHEUS METRICS MIDDLEWARE
const metricsMiddleware = promBundle({
    includeMethod: true,
    includePath: true,
    includeStatusCode: true,
    normalizePath: [
        ['^/users/.*',         '/users/:username'],
        ['^/history/.*',       '/history/:username'],
        ['^/stats/.*',         '/stats/:username'],
        ['^/profile/.*',       '/profile/:username'],
        ['^/friends/.*',       '/friends/:username'],
        ['^/notifications/.*', '/notifications/:id'],
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

// =============================   USERS ENDPOINTS    ============================================

/**
 * POST /createuser
 * Saves NEW USER in the db and sends a welcome notification.
 */
app.post('/createuser', async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username) {
            return res.status(400).json({ success: false, error: 'Username is a mandatory field' });
        }

        if (password === undefined || password === null) {
            return res.status(400).json({ success: false, error: 'Password is a mandatory field' });
        }

        let processedEmail = undefined;
        if (email && typeof email === 'string' && email.trim() !== '') {
            processedEmail = email.trim();
        }

        const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

        const newUser = new User({
            username: username.toString().trim(),
            email: processedEmail,
            password: hashedPassword
        });
        const savedUser = await newUser.save();

        // ── Welcome notification (fire-and-forget, never blocks registration) ──
        Notification.create({
            recipient: savedUser.username,
            type: 'welcome',
            from: null,
            read: false,
        }).catch(err => console.error('Failed to create welcome notification:', err));

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
            return res.status(400).json({ success: false, error: errors.join(', ') });
        }

        console.error('Error en POST /createuser:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * GET /users/:username
 */
app.get('/users/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const user = await User.findOne({ username: username.toString() });

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

/**
 * GET /users
 */
app.get('/users', async (req, res) => {
    try {
        const users = await User.find({}, { password: 0 }).sort({ createdAt: -1 });
        res.json({ success: true, count: users.length, users });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

/**
 * GET /search?q=<query>
 */
app.get('/search', async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || typeof q !== 'string' || q.trim().length < 1) {
            return res.status(400).json({ success: false, error: 'Query parameter q is required' });
        }

        const pattern = /[.*+?^${}()|[\]\\]/g;
        const escaped = q.trim().replaceAll(pattern, String.raw`\$&`);
        const regex   = new RegExp(escaped, 'i');

        const users = await User.find(
            { $or: [{ username: regex }, { email: regex }] },
            { password: 0, friendRequests: 0 }
        ).limit(20);

        res.json({
            success: true,
            count: users.length,
            users: users.map(u => ({
                username: u.username,
                email:    u.email ?? null,
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
        const { username, opponent, result, score, winner, boardSize, gameMode } = req.body;

        if (!username || !opponent || !result) {
            return res.status(400).json({
                success: false,
                error: 'The are absent field/s : username, opponent, result are mandatory'
            });
        }

        const userExists = await User.findOne({ username: username.toString() });
        if (!userExists) {
            return res.status(404).json({ success: false, error: `The user ${username} does not exist` });
        }

        const game = new GameResult({
            username, opponent, result,
            winner: winner ?? null,
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

app.get('/history/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { limit = 20 } = req.query;

        const games = await GameResult.find({ username: username.toString() })
            .sort({ date: -1 })
            .limit(Number.parseInt(limit, 10));

        const stats = {
            wins:   games.filter(g => g.result === 'win').length,
            losses: games.filter(g => g.result === 'loss').length,
        };

        res.json({ success: true, username, stats, total: games.length, games });
    } catch (error) {
        console.error('Error in GET /history/:username:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.get('/ranking', async (req, res) => {
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
        const { username } = req.params;
        const page     = Math.max(1, Number.parseInt(req.query.page, 10)     || 1);
        const pageSize = Math.max(1, Number.parseInt(req.query.pageSize, 10) || 10);

        const userExists = await User.findOne({ username: username.toString() });
        if (!userExists) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        const allGames   = await GameResult.find({ username: username.toString() }).sort({ date: -1 });
        const totalGames = allGames.length;
        const wins       = allGames.filter(g => g.result === 'win').length;
        const losses     = allGames.filter(g => g.result === 'loss').length;
        const winRate    = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;

        const start          = (page - 1) * pageSize;
        const paginatedGames = allGames.slice(start, start + pageSize).map(g => ({
            opponent: g.opponent, result: g.result,
            boardSize: g.boardSize, gameMode: g.gameMode, date: g.date,
        }));

        const lastFive = allGames.slice(0, 5).map(g => ({
            opponent: g.opponent, result: g.result,
            boardSize: g.boardSize, gameMode: g.gameMode, date: g.date,
        }));

        res.json({
            success: true, username,
            stats: {
                totalGames, wins, losses, winRate,
                pvbGames: allGames.filter(g => g.gameMode === 'pvb').length,
                pvpGames: allGames.filter(g => g.gameMode === 'pvp').length,
                lastFive
            },
            games: paginatedGames, page, pageSize,
        });

    } catch (error) {
        console.error('Error in GET /stats/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.get('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;

        const user = await User.findOne({ username: username.toString() }, { password: 0 });
        if (!user) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        const allGames      = await GameResult.find({ username: username.toString() }).sort({ date: -1 });
        const totalGames    = allGames.length;
        const wins          = allGames.filter(g => g.result === 'win').length;
        const losses        = allGames.filter(g => g.result === 'loss').length;
        const winRate       = totalGames > 0 ? Math.round((wins / totalGames) * 100) : 0;
        const recentMatches = allGames.slice(0, 5).map(g => ({
            opponent: g.opponent, result: g.result,
            boardSize: g.boardSize, gameMode: g.gameMode, date: g.date,
        }));

        res.json({
            success: true,
            profile: {
                username:          user.username,
                realName:          user.realName ?? null,
                bio:               user.bio ?? null,
                location:          user.location ?? {},
                preferredLanguage: user.preferredLanguage ?? 'en',
                joinDate:          user.createdAt,
                stats:             { totalGames, wins, losses, winRate },
                recentMatches,
                friends:           user.friends ?? [],
                friendRequests:    user.friendRequests ?? [],
            }
        });

    } catch (error) {
        console.error('Error in GET /profile/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.patch('/profile/:username', async (req, res) => {
    try {
        const { username } = req.params;
        const { realName, bio, city, country, preferredLanguage } = req.body;

        const user = await User.findOne({ username: username.toString() });
        if (!user) {
            return res.status(404).json({ success: false, error: `User ${username} not found` });
        }

        if (realName !== undefined)           user.realName = realName;
        if (bio !== undefined)                user.bio = bio;
        if (city !== undefined)               user.location = { ...user.location, city };
        if (country !== undefined)            user.location = { ...user.location, country };
        if (preferredLanguage !== undefined)  user.preferredLanguage = preferredLanguage;

        await user.save();

        res.json({
            success: true,
            message: 'Profile updated',
            profile: {
                username:          user.username,
                realName:          user.realName ?? null,
                bio:               user.bio ?? null,
                location:          user.location ?? {},
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
        const targetUsername = req.params.username;
        const senderUsername = getUsernameFromToken(req.headers.authorization);

        if (!senderUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }
        if (senderUsername === targetUsername) {
            return res.status(400).json({ success: false, error: 'You cannot send a friend request to yourself' });
        }

        const target = await User.findOne({ username: targetUsername });
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

        // ── Auto-create notification (fire-and-forget) ──
        Notification.create({
            recipient: targetUsername,
            type: 'friend_request',
            from: senderUsername,
            read: false,
        }).catch(err => console.error('Failed to create friend_request notification:', err));

        res.status(201).json({ success: true, message: `Friend request sent to ${targetUsername}` });

    } catch (error) {
        console.error('Error in POST /friends/request/:username:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

app.post('/friends/accept/:username', async (req, res) => {
    try {
        const senderUsername   = req.params.username;
        const acceptorUsername = getUsernameFromToken(req.headers.authorization);

        if (!acceptorUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const acceptor = await User.findOne({ username: acceptorUsername });
        if (!acceptor) {
            return res.status(404).json({ success: false, error: 'Acceptor user not found' });
        }
        if (!acceptor.friendRequests.includes(senderUsername)) {
            return res.status(404).json({ success: false, error: 'No pending request from that user' });
        }

        const sender = await User.findOne({ username: senderUsername });
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
        const targetUsername  = req.params.username;
        const currentUsername = getUsernameFromToken(req.headers.authorization);

        if (!currentUsername) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const current = await User.findOne({ username: currentUsername });
        const target  = await User.findOne({ username: targetUsername });

        if (!current || !target) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }

        current.friends = current.friends.filter(u => u !== targetUsername);
        target.friends  = target.friends.filter(u => u !== currentUsername);

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
        const currentUsername = getUsernameFromToken(req.headers.authorization);
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

// =========================   NOTIFICATIONS ENDPOINTS   =====================

/**
 * GET /notifications
 * Returns all notifications for the authenticated user, newest first.
 * Includes unreadCount for the badge.
 * Requires JWT.
 */
app.get('/notifications', async (req, res) => {
    try {
        const username = getUsernameFromToken(req.headers.authorization);
        if (!username) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const notifications = await Notification.find({ recipient: username })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = notifications.filter(n => !n.read).length;

        res.json({
            success: true,
            notifications: notifications.map(n => ({
                id:        n._id,
                type:      n.type,
                from:      n.from,
                read:      n.read,
                createdAt: n.createdAt,
            })),
            unreadCount,
        });

    } catch (error) {
        console.error('Error in GET /notifications:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

/**
 * PATCH /notifications/:id/read
 * Marks a single notification as read.
 * Requires JWT. Only the recipient can mark their own notification.
 */
app.patch('/notifications/:id/read', async (req, res) => {
    try {
        const username = getUsernameFromToken(req.headers.authorization);
        if (!username) {
            return res.status(401).json({ success: false, error: 'Unauthorized' });
        }

        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({ success: false, error: 'Invalid notification id' });
        }

        const notification = await Notification.findById(id);

        if (!notification) {
            return res.status(404).json({ success: false, error: 'Notification not found' });
        }

        if (notification.recipient !== username) {
            return res.status(403).json({ success: false, error: 'Forbidden' });
        }

        notification.read = true;
        await notification.save();

        res.json({
            success: true,
            notification: {
                id:        notification._id,
                type:      notification.type,
                from:      notification.from,
                read:      notification.read,
                createdAt: notification.createdAt,
            }
        });

    } catch (error) {
        console.error('Error in PATCH /notifications/:id/read:', error);
        res.status(500).json({ success: false, error: 'Internal server error' });
    }
});

// ── Health ────────────────────────────────────────────────────────────────────

app.get('/health', async (req, res) => {
    const dbState = mongoose.connection.readyState;
    const states  = ['disconnected', 'connected', 'connecting', 'disconnecting'];
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