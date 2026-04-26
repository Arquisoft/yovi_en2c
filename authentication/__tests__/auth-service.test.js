import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import jwt from "jsonwebtoken";
import axios from "axios";
import bcrypt from "bcryptjs";

vi.mock("axios");

process.env.JWT_SECRET = "false_test_secret_for_auth_service";
process.env.JWT_EXPIRES = "24h";
process.env.USERS_SERVICE_URL = "http://localhost:3000";

const { default: app } = await import("../auth-service.js");

describe("Auth Service", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Health endpoint", () => {
    it("GET /health returns service status", async () => {
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.status).toBe("OK");
      expect(res.body.server).toBe("running");
      expect(res.body.service).toBe("auth-service");
      expect(res.body).toHaveProperty("timestamp");
    });
  });

  describe("Register endpoint", () => {
    it("POST /register returns 400 if username is missing", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          email: "ana@uniovi.es",
          password: "1234",
          repeatPassword: "1234"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Username is a mandatory field/i);
    });

    it("POST /register returns 400 if password is missing", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          repeatPassword: "1234"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Password is a mandatory field/i);
    });

    it("POST /register returns 400 if repeatPassword is missing", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          password: "1234"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Repeat password is a mandatory field/i);
    });

    it("POST /register returns 400 if password has less than 4 characters", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          password: "123",
          repeatPassword: "123"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/at least 4 characters/i);
    });

    it("POST /register returns 400 if passwords do not match", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          password: "1234",
          repeatPassword: "5678"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/must be equal/i);
    });

    it("POST /register returns 400 if email is not a string", async () => {
      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: 123,
          password: "1234",
          repeatPassword: "1234"
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Email must be a string/i);
    });

    it("POST /register creates user and returns token", async () => {
      axios.post.mockResolvedValueOnce({
        status: 201,
        data: {
          success: true,
          message: "User Ana created",
          user: {
            id: "507f1f77bcf86cd799439011",
            username: "Ana",
            email: "ana@uniovi.es",
            createdAt: "2026-03-17T10:00:00.000Z"
          }
        }
      });

      const payload = {
        username: "Ana",
        email: "ana@uniovi.es",
        password: "1234",
        repeatPassword: "1234"
      };

      const res = await request(app)
        .post("/register")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/User registered successfully/i);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.username).toBe("Ana");

      expect(axios.post).toHaveBeenCalledTimes(1);
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/createuser$/),
        {
          username: "Ana",
          email: "ana@uniovi.es",
          password: "1234"
        }
      );
    });

    it("POST /register propagates users-service error response", async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { success: false, error: "The username field is already in the data base" }
        }
      });

      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          password: "1234",
          repeatPassword: "1234"
        });

      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/already in the data base/i);
    });

    it("POST /register returns 500 if users-service fails without response", async () => {
      axios.post.mockRejectedValueOnce(new Error("Service down"));

      const res = await request(app)
        .post("/register")
        .send({
          username: "Ana",
          email: "ana@uniovi.es",
          password: "1234",
          repeatPassword: "1234"
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Internal server error/i);
    });
  });

  describe("Login endpoint", () => {
    it("POST /login returns 400 if username is missing", async () => {
      const res = await request(app)
        .post("/login")
        .send({ password: "1234" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Username is a mandatory field/i);
    });

    it("POST /login returns 400 if password is missing", async () => {
      const res = await request(app)
        .post("/login")
        .send({ username: "Ana" });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Password is a mandatory field/i);
    });

    it("POST /login returns 404 if user does not exist", async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { success: false, error: "User not found" }
        }
      });

      const res = await request(app)
        .post("/login")
        .send({
          username: "Ana",
          password: "1234"
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/User not found/i);
    });

    it("POST /login returns 401 if credentials are invalid", async () => {
      const hashedPassword = await bcrypt.hash("correct_password", 10);

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          user: {
            id: "507f1f77bcf86cd799439011",
            username: "Ana",
            email: "ana@uniovi.es",
            password: hashedPassword,
            createdAt: "2026-03-17T10:00:00.000Z"
          }
        }
      });

      const res = await request(app)
        .post("/login")
        .send({
          username: "Ana",
          password: "wrong_password"
        });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid credentials/i);
    });

    it("POST /login returns token when credentials are valid", async () => {
      const hashedPassword = await bcrypt.hash("1234", 10);

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          user: {
            id: "507f1f77bcf86cd799439011",
            username: "Ana",
            email: "ana@uniovi.es",
            password: hashedPassword,
            createdAt: "2026-03-17T10:00:00.000Z"
          }
        }
      });

      const res = await request(app)
        .post("/login")
        .send({
          username: "Ana",
          password: "1234"
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Welcome Ana/i);
      expect(res.body).toHaveProperty("token");
      expect(res.body).toHaveProperty("user");
      expect(res.body.user.username).toBe("Ana");

      expect(axios.get).toHaveBeenCalledTimes(1);
      expect(axios.get).toHaveBeenCalledWith(
        expect.stringMatching(/\/users\/Ana$/)
      );
    });

    it("POST /login returns 500 if users-service fails without response", async () => {
      axios.get.mockRejectedValueOnce(new Error("Service down"));

      const res = await request(app)
        .post("/login")
        .send({
          username: "Ana",
          password: "1234"
        });

      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Internal server error/i);
    });
  });

  describe("Verify endpoint", () => {
    it("GET /verify returns 401 if Authorization header is missing", async () => {
      const res = await request(app).get("/verify");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid Authorization header/i);
    });

    it("GET /verify returns 401 if Authorization header is invalid", async () => {
      const res = await request(app)
        .get("/verify")
        .set("Authorization", "InvalidToken");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid Authorization header/i);
    });

    it("GET /verify returns 401 if token is invalid", async () => {
      const res = await request(app)
        .get("/verify")
        .set("Authorization", "Bearer invalid_token_here");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired token/i);
    });

    it("GET /verify returns decoded user if token is valid", async () => {
      const token = jwt.sign(
        {
          id: "507f1f77bcf86cd799439011",
          username: "Ana",
          email: "ana@uniovi.es"
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES }
      );

      const res = await request(app)
        .get("/verify")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/Token valid/i);
      expect(res.body.user.username).toBe("Ana");
      expect(res.body.user.email).toBe("ana@uniovi.es");
    });
  });

  describe("Logout endpoint", () => {
    const createValidToken = (username = "Ana") =>
      jwt.sign(
        {
          id: "507f1f77bcf86cd799439011",
          username,
          email: `${username.toLowerCase()}@uniovi.es`,
        },
        process.env.JWT_SECRET,
        { expiresIn: process.env.JWT_EXPIRES }
      );

    it("POST /logout returns 401 if Authorization header is missing", async () => {
      const res = await request(app).post("/logout");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid Authorization header/i);
    });

    it("POST /logout returns 401 if Authorization header is invalid", async () => {
      const res = await request(app)
        .post("/logout")
        .set("Authorization", "InvalidToken");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid Authorization header/i);
    });

    it("POST /logout returns 401 if token is invalid", async () => {
      const res = await request(app)
        .post("/logout")
        .set("Authorization", "Bearer invalid_token_here");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired token/i);
    });

    it("POST /logout revokes a valid token", async () => {
      const token = createValidToken("LogoutUser");

      const logoutRes = await request(app)
        .post("/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.success).toBe(true);
      expect(logoutRes.body.message).toMatch(/Logged out successfully/i);

      const verifyRes = await request(app)
        .get("/verify")
        .set("Authorization", `Bearer ${token}`);

      expect(verifyRes.status).toBe(401);
      expect(verifyRes.body.success).toBe(false);
      expect(verifyRes.body.error).toMatch(/Token has been revoked/i);
    });

    it("POST /logout returns 401 when token was already revoked", async () => {
      const token = createValidToken("AlreadyRevokedUser");

      await request(app)
        .post("/logout")
        .set("Authorization", `Bearer ${token}`);

      const res = await request(app)
        .post("/logout")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Token has been revoked/i);
    });
  });
});