const express = require('express');
require('dotenv').config();

const { register, login, verifyToken } = require('./authentication');
const authMiddleware = require('./authMiddleware');

const app = express();

// Middleware
app.use(express.json());


// ================= ROUTES =================

// Register new user (delegates to users-service)
app.post('/register', register);

// Login user (delegates to users-service, then issues JWT)
app.post('/login', login);

// Verify JWT token — protected route
app.get('/verify', authMiddleware, verifyToken);


// ================= HEALTH CHECK =================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'auth-service',
        timestamp: new Date(),
    });
});

// ================= METRICS =================

const client = require("prom-client");

// collect default Node metrics (CPU, memory, event loop, etc.)
client.collectDefaultMetrics();

app.get("/metrics", async (req, res) => {
    res.set("Content-Type", client.register.contentType);
    res.end(await client.register.metrics());
});

// ================= EXPORT FOR TESTING =================

module.exports = app;


// ================= START SERVER =================

if (require.main === module) {
    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`Auth service running on port ${PORT}`);
        console.log('Endpoints:');
        console.log('  POST  /register');
        console.log('  POST  /login');
        console.log('  GET   /verify');
        console.log('  GET   /health');
    });
}