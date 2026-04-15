const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';
const USERS_SERVICE_URL = "http://users:3000";

// Helper: call users-service with native fetch (Node >= 18)
async function callUsersService(path, body) {
    const res = await fetch(`${USERS_SERVICE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    });
    const data = await res.json();
    return { status: res.status, data };
}


// ================= REGISTER =================

const register = async (req, res) => {
    try {
        const { username, email, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required',
            });
        }

        // Delegate user creation entirely to users-service.
        // That service owns the user store and enforces uniqueness.
        const { status, data } = await callUsersService('/createuser', {
            username,
            email,
            password,
        });

        if (status === 201 && data.success) {
            return res.status(201).json({
                success: true,
                message: 'User registered successfully',
            });
        }

        // Surface the error from users-service (e.g. duplicate username)
        return res.status(status).json({
            success: false,
            error: data.error || 'Registration failed',
        });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


// ================= LOGIN =================

const login = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({
                success: false,
                error: 'Username and password required',
            });
        }

        // Delegate credential verification to users-service.
        // That service compares the stored password.
        const { status, data } = await callUsersService('/login', {
            username,
            password,
        });

        if (status !== 200 || !data.success) {
            return res.status(status).json({
                success: false,
                error: data.error || 'Invalid credentials',
            });
        }

        // Credentials are valid — issue a JWT
        const token = jwt.sign(
            { id: data.user.id, username: data.user.username },
            JWT_SECRET,
            { expiresIn: JWT_EXPIRES }
        );

        return res.json({ success: true, token });

    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
};


// ================= VERIFY TOKEN =================

const verifyToken = (req, res) => {
    res.json({ success: true, user: req.user });
};


module.exports = { register, login, verifyToken };