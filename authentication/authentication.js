const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const axios = require('axios');

const AuthUser = require('./models/AuthUser');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || '24h';
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL;



// ================= REGISTER =================

const register = async (req, res) => {

    try {

        const { username, email, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({
                success: false,
                error: 'Username and password required'
            });
        }

        const existingUser = await AuthUser.findOne({ username });

        if (existingUser) {

            return res.status(400).json({
                success: false,
                error: 'User already exists'
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const user = new AuthUser({

            username,
            email,
            password: hashedPassword

        });

        await user.save();

        // 🔗 CALL USERS SERVICE
        await axios.post(`${USERS_SERVICE_URL}/createuser`, {
            username,
            email
        });

        res.status(201).json({

            success: true,
            message: 'User registered successfully'
        });

    } catch (error) {

        res.status(500).json({

            success: false,
            error: error.message
        });
    }
};


// ================= LOGIN =================

const login = async (req, res) => {

    try {

        const { username, password } = req.body;

        if (!username || !password) {

            return res.status(400).json({

                success: false,
                error: 'Username and password required'
            });
        }

        const user = await AuthUser.findOne({ username });

        if (!user) {

            return res.status(401).json({

                success: false,
                error: 'Invalid credentials'
            });
        }

        const validPassword = await bcrypt.compare(password, user.password);

        if (!validPassword) {

            return res.status(401).json({

                success: false,
                error: 'Invalid credentials'
            });
        }

        const token = jwt.sign(

            {
                id: user._id,
                username: user.username
            },

            JWT_SECRET,

            {
                expiresIn: JWT_EXPIRES
            }
        );

        res.json({

            success: true,
            token
        });

    } catch (error) {

        res.status(500).json({

            success: false,
            error: error.message
        });
    }
};


// ================= VERIFY TOKEN =================

const verifyToken = (req, res) => {

    res.json({

        success: true,
        user: req.user
    });
};


module.exports = {

    register,
    login,
    verifyToken

};