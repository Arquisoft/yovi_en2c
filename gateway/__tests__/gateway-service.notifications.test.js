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
      user: { username: "Pablo" },
    },
  });
};

describe("Gateway — GET /notifications", () => {
  afterEach(() => vi.clearAllMocks());

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).get("/notifications");

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Authorization header required/i);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("returns 401 when token is malformed", async () => {
    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "NotBearer token");

    expect(res.status).toBe(401);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it("forwards the request with sanitized JWT to users service", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { success: true, notifications: [], unreadCount: 0 },
    });

    await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer my_token");

    expect(axios.get).toHaveBeenLastCalledWith(
      expect.stringMatching(/\/notifications$/),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my_token",
        }),
      })
    );
  });

  it("returns 200 with notifications and unreadCount", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        notifications: [
          {
            id: "abc",
            type: "welcome",
            from: null,
            read: false,
            createdAt: "2026-04-01",
          },
        ],
        unreadCount: 1,
      },
    });

    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.unreadCount).toBe(1);
  });

  it("returns 200 with empty array when user has no notifications", async () => {
    mockVerifyOk();

    axios.get.mockResolvedValueOnce({
      status: 200,
      data: { success: true, notifications: [], unreadCount: 0 },
    });

    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.notifications).toEqual([]);
    expect(res.body.unreadCount).toBe(0);
  });

  it("propagates 401 from users service", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce({
      response: { status: 401, data: { error: "Unauthorized" } },
    });

    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer bad_token");

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
  });

  it("returns 502 when users service is unreachable", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce(new Error("Connection refused"));

    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Users service unavailable/i);
  });

  it("propagates 500 from users service", async () => {
    mockVerifyOk();

    axios.get.mockRejectedValueOnce({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const res = await request(app)
      .get("/notifications")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});

describe("Gateway — PATCH /notifications/:id/read", () => {
  afterEach(() => vi.clearAllMocks());

  const validId = "507f1f77bcf86cd799439011";

  it("returns 400 when id is not a valid ObjectId", async () => {
    const res = await request(app)
      .patch("/notifications/not-valid-id/read")
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(400);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Invalid notification id/i);
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = await request(app).patch(`/notifications/${validId}/read`);

    expect(res.status).toBe(401);
    expect(res.body.ok).toBe(false);
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("returns 401 when Authorization token is malformed", async () => {
    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "InvalidHeader");

    expect(res.status).toBe(401);
    expect(axios.patch).not.toHaveBeenCalled();
  });

  it("returns 200 and forwards the request to users service", async () => {
    axios.patch.mockResolvedValueOnce({
      status: 200,
      data: {
        success: true,
        notification: {
          id: validId,
          type: "welcome",
          from: null,
          read: true,
          createdAt: "2026-04-01",
        },
      },
    });

    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.notification.read).toBe(true);
  });

  it("forwards sanitized Authorization header to users service", async () => {
    axios.patch.mockResolvedValueOnce({
      status: 200,
      data: { success: true, notification: { id: validId, read: true } },
    });

    await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer my_read_token");

    expect(axios.patch).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`/notifications/${validId}/read$`)),
      {},
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Bearer my_read_token",
        }),
      })
    );
  });

  it("propagates 403 when user tries to mark another user's notification", async () => {
    axios.patch.mockRejectedValueOnce({
      response: { status: 403, data: { error: "Forbidden" } },
    });

    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(403);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Forbidden/i);
  });

  it("propagates 404 when notification is not found", async () => {
    axios.patch.mockRejectedValueOnce({
      response: { status: 404, data: { error: "Notification not found" } },
    });

    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(404);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/not found/i);
  });

  it("returns 502 when users service is unreachable", async () => {
    axios.patch.mockRejectedValueOnce(new Error("Service down"));

    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(502);
    expect(res.body.ok).toBe(false);
    expect(res.body.error).toMatch(/Users service unavailable/i);
  });

  it("propagates 500 from users service", async () => {
    axios.patch.mockRejectedValueOnce({
      response: { status: 500, data: { error: "Internal server error" } },
    });

    const res = await request(app)
      .patch(`/notifications/${validId}/read`)
      .set("Authorization", "Bearer valid_token");

    expect(res.status).toBe(500);
    expect(res.body.ok).toBe(false);
  });
});