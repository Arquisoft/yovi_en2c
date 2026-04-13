import express from "express";
import cors from "cors";
import axios from "axios";
import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import bcrypt from "bcryptjs";

dotenv.config();

const app = express();
app.disable("x-powered-by");

app.use(express.json());
app.use(cors({
  origin: true,
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));

const PORT = process.env.PORT || 5000;
const USERS_SERVICE_URL = process.env.USERS_SERVICE_URL || "http://localhost:3000";
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES = process.env.JWT_EXPIRES || "24h";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET is required in environment variables");
}

/**
 * Generate JWT token for a user
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id || user._id,
      username: user.username,
      email: user.email || null
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

/**
 * Extract Bearer token from Authorization header
 */
function getTokenFromHeader(authHeader) {
  if (!authHeader || typeof authHeader !== "string") {
    return null;
  }
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7).trim();
}

/**
 * Middleware to verify JWT
 */
function authenticateToken(req, res, next) {
  const token = getTokenFromHeader(req.headers.authorization);

  if (!token) {
    return res.status(401).json({
      success: false,
      error: "Missing or invalid Authorization header"
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT verification failed:", error);
    return res.status(401).json({
      success: false,
      error: "Invalid or expired token"
    });
  }
}

/**
 * Validate register payload
 */
function validateRegisterData(body) {
  const { username, email, password, repeatPassword } = body;

  if (!username || typeof username !== "string" || username.trim() === "") {
    return "Username is a mandatory field";
  }

  if (!password || typeof password !== "string") {
    return "Password is a mandatory field";
  }

  if (!repeatPassword || typeof repeatPassword !== "string") {
    return "Repeat password is a mandatory field";
  }

  if (password.length < 4) {
    return "Password must have at least 4 characters";
  }

  if (password !== repeatPassword) {
    return "Password and repeat password must be equal";
  }

  if (email !== undefined && email !== null && typeof email !== "string") {
    return "Email must be a string";
  }

  return null;
}

/**
 * Validate login payload
 */
function validateLoginData(body) {
  const { username, password } = body;

  if (!username || typeof username !== "string" || username.trim() === "") {
    return "Username is a mandatory field";
  }

  if (!password || typeof password !== "string") {
    return "Password is a mandatory field";
  }

  return null;
}

/**
 * Health endpoint
 */
app.get("/health", async (req, res) => {
  res.json({
    status: "OK",
    server: "running",
    service: "auth-service",
    timestamp: new Date()
  });
});

/**
 * POST /register
 * Validates credentials and delegates user creation to users-service
 */
app.post("/register", async (req, res) => {
  try {
    const validationError = validateRegisterData(req.body);

    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const { username, email, password } = req.body;

    const response = await axios.post(`${USERS_SERVICE_URL}/createuser`, {
      username: username.trim(),
      email,
      password
    });

    const createdUser = response.data?.user;

    const token = generateToken(createdUser);

    return res.status(201).json({
      success: true,
      message: "User registered successfully",
      token,
      user: createdUser
    });
  } catch (error) {
    const status = error.response?.status || 500;
    const data = error.response?.data;

    return res.status(status).json(
      data || {
        success: false,
        error: "Internal server error"
      }
    );
  }
});

/**
 * POST /login
 * Delegates user lookup to users-service and creates JWT
 */
app.post("/login", async (req, res) => {
  try {
    const validationError = validateLoginData(req.body);
    if (validationError) {
      return res.status(400).json({
        success: false,
        error: validationError
      });
    }

    const { username, password } = req.body;

    const response = await axios.get(
      `${USERS_SERVICE_URL}/users/${encodeURIComponent(username.trim())}`
    );

    const user = response.data?.user;

    if (!user) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: "Invalid credentials"
      });
    }

    const token = generateToken(user);

    return res.json({
      success: true,
      message: `Welcome ${user.username}`,
      token,
      user: {
        id: user.id || user._id,
        username: user.username,
        email: user.email || null,
        createdAt: user.createdAt || null
      }
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({
        success: false,
        error: "User not found"
      });
    }

    return res.status(error.response?.status || 500).json(
      error.response?.data || {
        success: false,
        error: "Internal server error"
      }
    );
  }
});

/**
 * GET /verify
 * Verifies that the JWT is valid
 */
app.get("/verify", authenticateToken, async (req, res) => {
  return res.json({
    success: true,
    message: "Token valid",
    user: req.user
  });
});

export default app;

/**
 * Start server only if this file is executed directly
 */
if (process.argv[1]?.includes("auth-service.js")) {
  app.listen(PORT, () => {
    console.log(`🚀 Auth service running on http://localhost:${PORT}`);
    console.log("📡 Endpoints available:");
    console.log("   POST   /register");
    console.log("   POST   /login");
    console.log("   GET    /verify");
    console.log("   GET    /health");
  });
}

process.on("unhandledRejection", (error) => {
  console.error("❌ Unhandled Rejection:", error);
});