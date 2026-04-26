import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import app from "../gateway-service.js";
import axios from "axios";

vi.mock("axios");

const mockVerifyOk = () => {
  axios.get.mockResolvedValueOnce({
    status: 200,
    data: {
      success: true,
      user: { username: "pablo" },
    },
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// GET /search
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — GET /search", () => {

    afterEach(() => vi.clearAllMocks());

    // ── Validation ────────────────────────────────────────────────────────────

    it("returns 400 when q parameter is missing", async () => {
        const res = await request(app).get("/search");

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/q is required/i);
        expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns 400 when q is an empty string", async () => {
        const res = await request(app).get("/search?q=");

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
        expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns 400 when q is only whitespace", async () => {
        const res = await request(app).get("/search?q=   ");

        expect(res.status).toBe(400);
        expect(res.body.ok).toBe(false);
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it("returns 200 and forwards results from users service", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: {
                success: true,
                count: 2,
                users: [
                    { username: "maria99",  email: "maria@example.com", realName: "Maria" },
                    { username: "maricel",  email: "maricel@uni.es",    realName: null },
                ],
            },
        });

        const res = await request(app).get("/search?q=maria");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(2);
        expect(res.body.users).toHaveLength(2);
        expect(res.body.users[0].username).toBe("maria99");
    });

    it("forwards the q param to users service URL", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, count: 0, users: [] },
        });

        await request(app).get("/search?q=testquery");

        expect(axios.get).toHaveBeenCalledWith(
            expect.stringContaining("q=testquery")
        );
    });

    it("trims whitespace from q before forwarding", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, count: 0, users: [] },
        });

        await request(app).get("/search?q=  mario  ");

        const calledUrl = axios.get.mock.calls[0][0];
        // The trimmed value should be in the URL, not the raw spaces
        expect(decodeURIComponent(calledUrl)).toContain("q=mario");
    });

    it("returns empty array when users service returns no results", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, count: 0, users: [] },
        });

        const res = await request(app).get("/search?q=zzznobody");

        expect(res.status).toBe(200);
        expect(res.body.users).toEqual([]);
        expect(res.body.count).toBe(0);
    });

    // ── Error forwarding ──────────────────────────────────────────────────────

    it("returns 502 when users service is unreachable", async () => {
        axios.get.mockRejectedValueOnce(new Error("Connection refused"));

        const res = await request(app).get("/search?q=test");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    it("propagates 500 from users service", async () => {
        axios.get.mockRejectedValueOnce({
            response: { status: 500, data: { error: "Internal server error" } },
        });

        const res = await request(app).get("/search?q=test");

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /friends/request/:username
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — POST /friends/request/:username", () => {

    afterEach(() => vi.clearAllMocks());

    // ── Validation ────────────────────────────────────────────────────────────

    it("returns 401 when Authorization header is missing", async () => {
        const res = await request(app).post("/friends/request/bob");

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Authorization header required/i);
        expect(axios.post).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization token is malformed", async () => {
        const res = await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "InvalidHeader");

        expect(res.status).toBe(401);
        expect(axios.post).not.toHaveBeenCalled();
    });

    // ── Happy path ────────────────────────────────────────────────────────────

    it("returns 201 and forwards the friend request to users service", async () => {
        axios.post.mockResolvedValueOnce({
            status: 201,
            data: { success: true, message: "Friend request sent to bob" },
        });

        const res = await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/bob/i);
    });

    it("forwards sanitized Authorization header to users service", async () => {
        axios.post.mockResolvedValueOnce({
            status: 201,
            data: { success: true, message: "Friend request sent to bob" },
        });

        await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "Bearer my_jwt_token");

        expect(axios.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/friends\/request\/bob$/),
            {},
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer my_jwt_token" }),
            })
        );
    });

    // ── Error forwarding ──────────────────────────────────────────────────────

    it("propagates 400 when user tries to add themselves", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 400, data: { error: "You cannot send a friend request to yourself" } },
        });

        const res = await request(app)
            .post("/friends/request/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/yourself/i);
    });

    it("propagates 404 when target user does not exist", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 404, data: { error: "User nobody not found" } },
        });

        const res = await request(app)
            .post("/friends/request/nobody")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    it("propagates 409 when request is already pending or already friends", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 409, data: { error: "Friend request already sent" } },
        });

        const res = await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already sent/i);
    });

    it("returns 502 when users service is unreachable", async () => {
        axios.post.mockRejectedValueOnce(new Error("Connection refused"));

        const res = await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    it("propagates 500 from users service", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 500, data: { error: "Internal server error" } },
        });

        const res = await request(app)
            .post("/friends/request/bob")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /friends/accept/:username
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — POST /friends/accept/:username", () => {

    afterEach(() => vi.clearAllMocks());

    it("returns 401 when Authorization header is missing", async () => {
        const res = await request(app).post("/friends/accept/alice");

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(axios.post).not.toHaveBeenCalled();
    });

    it("returns 200 and confirms friendship on success", async () => {
        axios.post.mockResolvedValueOnce({
            status: 200,
            data: { success: true, message: "You are now friends with alice" },
        });

        const res = await request(app)
            .post("/friends/accept/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/friends with alice/i);
    });

    it("forwards sanitized Authorization header to users service", async () => {
        axios.post.mockResolvedValueOnce({
            status: 200,
            data: { success: true, message: "You are now friends with alice" },
        });

        await request(app)
            .post("/friends/accept/alice")
            .set("Authorization", "Bearer accept_token");

        expect(axios.post).toHaveBeenCalledWith(
            expect.stringMatching(/\/friends\/accept\/alice$/),
            {},
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer accept_token" }),
            })
        );
    });

    it("propagates 404 when no pending request exists", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 404, data: { error: "No pending request from that user" } },
        });

        const res = await request(app)
            .post("/friends/accept/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/no pending request/i);
    });

    it("propagates 401 from users service when JWT is invalid", async () => {
        axios.post.mockRejectedValueOnce({
            response: { status: 401, data: { error: "Unauthorized" } },
        });

        const res = await request(app)
            .post("/friends/accept/alice")
            .set("Authorization", "Bearer bad_token");

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
    });

    it("returns 502 when users service is unreachable", async () => {
        axios.post.mockRejectedValueOnce(new Error("Service down"));

        const res = await request(app)
            .post("/friends/accept/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /friends/:username
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — DELETE /friends/:username", () => {

    afterEach(() => vi.clearAllMocks());

    it("returns 401 when Authorization header is missing", async () => {
        const res = await request(app).delete("/friends/alice");

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(axios.delete).not.toHaveBeenCalled();
    });

    it("returns 200 when friend is removed successfully", async () => {
        axios.delete.mockResolvedValueOnce({
            status: 200,
            data: { success: true, message: "alice removed from your friends" },
        });

        const res = await request(app)
            .delete("/friends/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toMatch(/alice/i);
    });

    it("forwards sanitized Authorization header to users service", async () => {
        axios.delete.mockResolvedValueOnce({
            status: 200,
            data: { success: true, message: "alice removed from your friends" },
        });

        await request(app)
            .delete("/friends/alice")
            .set("Authorization", "Bearer delete_token");

        expect(axios.delete).toHaveBeenCalledWith(
            expect.stringMatching(/\/friends\/alice$/),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer delete_token" }),
            })
        );
    });

    it("propagates 404 when user is not found", async () => {
        axios.delete.mockRejectedValueOnce({
            response: { status: 404, data: { error: "User not found" } },
        });

        const res = await request(app)
            .delete("/friends/nobody")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 502 when users service is unreachable", async () => {
        axios.delete.mockRejectedValueOnce(new Error("Service down"));

        const res = await request(app)
            .delete("/friends/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    it("propagates 500 from users service", async () => {
        axios.delete.mockRejectedValueOnce({
            response: { status: 500, data: { error: "Internal server error" } },
        });

        const res = await request(app)
            .delete("/friends/alice")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /friends
// ─────────────────────────────────────────────────────────────────────────────

describe("Gateway — GET /friends", () => {

    afterEach(() => vi.clearAllMocks());

    it("returns 401 when Authorization header is missing", async () => {
        const res = await request(app).get("/friends");

        expect(res.status).toBe(401);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Authorization header required/i);
        expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization token is malformed", async () => {
        const res = await request(app)
            .get("/friends")
            .set("Authorization", "NotBearer token");

        expect(res.status).toBe(401);
        expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns 200 with the friends list", async () => {
        mockVerifyOk();

        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, friends: ["bob", "carol"] },
        });

        const res = await request(app)
            .get("/friends")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.friends).toEqual(["bob", "carol"]);
        });

        it("returns 200 with an empty array when user has no friends", async () => {
        mockVerifyOk();

        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, friends: [] },
        });

        const res = await request(app)
            .get("/friends")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(200);
        expect(res.body.friends).toEqual([]);
        });

    it("forwards sanitized Authorization header to users service", async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, friends: [] },
        });

        await request(app)
            .get("/friends")
            .set("Authorization", "Bearer my_friends_token");

        expect(axios.get).toHaveBeenCalledWith(
            expect.stringMatching(/\/friends$/),
            expect.objectContaining({
                headers: expect.objectContaining({ Authorization: "Bearer my_friends_token" }),
            })
        );
    });

    it("propagates 404 when user is not found", async () => {
        axios.get.mockRejectedValueOnce({
            response: { status: 404, data: { error: "User not found" } },
        });

        const res = await request(app)
            .get("/friends")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(404);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    it("returns 502 when users service is unreachable", async () => {
        mockVerifyOk();

        axios.get.mockRejectedValueOnce(new Error("Service down"));

        const res = await request(app)
            .get("/friends")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(502);
        expect(res.body.ok).toBe(false);
        expect(res.body.error).toMatch(/Users service unavailable/i);
    });

    it("propagates 500 from users service", async () => {
        axios.get.mockRejectedValueOnce({
            response: { status: 500, data: { error: "Internal server error" } },
        });

        const res = await request(app)
            .get("/friends")
            .set("Authorization", "Bearer valid_token");

        expect(res.status).toBe(500);
        expect(res.body.ok).toBe(false);
    });
});
