const express = require('express');
require('dotenv').config();
require('./db');


const { register, login, verifyToken } = require('./authentication');
const authMiddleware = require('./middleware/authMiddleware');

const app = express();

// Middleware
app.use(express.json());


// ================= ROUTES =================

// Register new user
app.post('/register', register);

// Login user
app.post('/login', login);

// Verify JWT token
app.get('/verify', authMiddleware, verifyToken);


// ================= HEALTH CHECK =================

app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        service: 'auth-service',
        timestamp: new Date()
    });
});


// ================= EXPORT APP FOR TESTING =================

module.exports = app;


// ================= START SERVER =================

if (require.main === module) {

    const PORT = process.env.PORT || 5000;

    app.listen(PORT, () => {
        console.log(`  Auth service running on port ${PORT}`);
        console.log(`  Endpoints available:`);
        console.log(`   POST   /register`);
        console.log(`   POST   /login`);
        console.log(`   GET    /verify`);
        console.log(`   GET    /health`);
    });

}