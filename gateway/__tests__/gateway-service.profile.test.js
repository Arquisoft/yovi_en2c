import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

// ─────────────────────────────────────────────────────────────────────────────
// Shared mock data
// ─────────────────────────────────────────────────────────────────────────────

const mockProfile = {
    username: "testuser",
    realName: "Test User",
    bio: "I love board games",
    location: { city: "Oviedo", country: "Spain" },
    preferredLanguage: "en",
    joinDate: "2024-01-01T00:00:00.000Z",
    stats: { totalGames: 10, wins: 7, losses: 3, winRate: 70 },
    recentMatches: [
        { opponent: "minimax_bot", result: "win", boardSize: 7, gameMode: "pvb", date: "2026-04-01T10:00:00Z" },
    ],
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /profile/:username
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — GET /profile/:username", () => {

    afterEach(() => vi.clearAllMocks());

    // ── Happy path ────────────────────────────────────────────────────────────

    it("returns 200 with full profile data", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        const res = await request(app).get("/profile/testuser");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.profile.username).toBe("testuser");
        expect(res.body.profile.realName).toBe("Test User");
        expect(res.body.profile.bio).toBe("I love board games");
        expect(res.body.profile.location).toMatchObject({ city: "Oviedo", country: "Spain" });
        expect(res.body.profile.preferredLanguage).toBe("en");
        expect(res.body.profile).toHaveProperty("joinDate");
        expect(res.body.profile).toHaveProperty("stats");
        expect(res.body.profile).toHaveProperty("recentMatches");
    });

    it("forwards request to users service without Authorization header", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        await request(app).get("/profile/testuser");

        // Public endpoint — no auth header should be forwarded
        expect(axios.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/profile\/testuser$/)
        );
        expect(axios.get).toHaveBeenCalledTimes(1);
    });

    it("returns profile with null optional fields when user has no bio or realName", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: {
                success: true,
                profile: { ...mockProfile, realName: null, bio: null, location: {} },
            },
        });

        const res = await request(app).get("/profile/minimaluser");

        expect(res.status).toBe(200);
        expect(res.body.profile.realName).toBeNull();
        expect(res.body.profile.bio).toBeNull();
    });

    it("never exposes password field in response", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        const res = await request(app).get("/profile/testuser");

        expect(res.body.profile).not.toHaveProperty("password");
        expect(JSON.stringify(res.body)).not.toContain("password");
    });

    // ── 404 ───────────────────────────────────────────────────────────────────

    it("returns 404 when users service reports user not found", async () => {
        axios.get.mockRejectedValueOnce({
            response: {
                status: 404,
                data: { success: false, error: "User nobody not found" },
            },
        });

        const res = await request(app).get("/profile/nobody");

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    // ── 502 ───────────────────────────────────────────────────────────────────

    it("returns 502 when users service is unreachable", async () => {
        axios.get.mockRejectedValueOnce(new Error("Connection refused"));

        const res = await request(app).get("/profile/testuser");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    // ── 500 ───────────────────────────────────────────────────────────────────

    it("propagates 500 from users service", async () => {
        axios.get.mockRejectedValueOnce({
            response: {
                status: 500,
                data: { success: false, error: "Internal server error" },
            },
        });

        const res = await request(app).get("/profile/testuser");

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /profile/:username
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — PATCH /profile/:username", () => {

    afterEach(() => vi.clearAllMocks());

    // ── Happy path ────────────────────────────────────────────────────────────

    it("returns 200 and forwards updated profile", async () => {
        axios.patch.mockResolvedValueOnce({
            status: 200,
            data: {
                success: true,
                message: "Profile updated",
                profile: {
                    username: "testuser",
                    realName: "Updated Name",
                    bio: "New bio",
                    location: { city: "Madrid", country: "Spain" },
                    preferredLanguage: "es",
                },
            },
        });

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer test_token")
            .send({
                realName: "Updated Name",
                bio: "New bio",
                city: "Madrid",
                country: "Spain",
                preferredLanguage: "es",
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.profile.realName).toBe("Updated Name");
    });

    it("forwards Authorization header to users service", async () => {
        axios.patch.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer my_jwt")
            .send({ bio: "test" });

        expect(axios.patch).toHaveBeenCalledWith(
            expect.stringMatching(/\/profile\/testuser$/),
            expect.any(Object),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer my_jwt" }),
            })
        );
    });

    it("forwards only the fields sent in the body", async () => {
        axios.patch.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ bio: "Only bio" });

        expect(axios.patch).toHaveBeenCalledWith(
            expect.any(String),
            { bio: "Only bio" },
            expect.any(Object)
        );
    });

    it("accepts partial update with only preferredLanguage", async () => {
        axios.patch.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: { ...mockProfile, preferredLanguage: "es" } },
        });

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ preferredLanguage: "es" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it("does not expose password in PATCH response", async () => {
        axios.patch.mockResolvedValueOnce({
            status: 200,
            data: { success: true, profile: mockProfile },
        });

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ bio: "test" });

        expect(res.body.profile).not.toHaveProperty("password");
        expect(JSON.stringify(res.body)).not.toContain("password");
    });

    // ── 400: validation error ─────────────────────────────────────────────────

    it("propagates 400 validation error from users service", async () => {
        axios.patch.mockRejectedValueOnce({
            response: {
                status: 400,
                data: { success: false, error: "Bio must be at most 280 characters" },
            },
        });

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ bio: "x".repeat(300) });

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/280 characters/i);
    });

    // ── 404 ───────────────────────────────────────────────────────────────────

    it("returns 404 when user does not exist", async () => {
        axios.patch.mockRejectedValueOnce({
            response: {
                status: 404,
                data: { success: false, error: "User nobody not found" },
            },
        });

        const res = await request(app)
            .patch("/profile/nobody")
            .set("Authorization", "Bearer token")
            .send({ bio: "test" });

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    // ── 502 ───────────────────────────────────────────────────────────────────

    it("returns 502 when users service is unreachable", async () => {
        axios.patch.mockRejectedValueOnce(new Error("Connection refused"));

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ bio: "test" });

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    // ── 500 ───────────────────────────────────────────────────────────────────

    it("propagates 500 from users service", async () => {
        axios.patch.mockRejectedValueOnce({
            response: {
                status: 500,
                data: { success: false, error: "Internal server error" },
            },
        });

        const res = await request(app)
            .patch("/profile/testuser")
            .set("Authorization", "Bearer token")
            .send({ bio: "test" });

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});