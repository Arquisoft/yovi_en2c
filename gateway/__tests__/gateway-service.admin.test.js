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
      user: { username: "admin", role: "admin", isRootAdmin: true },
    },
  });
};

describe("Gateway — Admin endpoints", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /admin/me", () => {
    it("returns 401 when Authorization header is missing", async () => {
      const res = await request(app).get("/admin/me");

      expect(res.status).toBe(401);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Authorization header required/i);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns 401 when Authorization header is malformed", async () => {
      const res = await request(app)
        .get("/admin/me")
        .set("Authorization", "bad-token");

      expect(res.status).toBe(401);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("forwards request to users service with sanitized auth", async () => {
      mockVerifyOk();

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          user: { username: "admin", role: "admin", isRootAdmin: true },
        },
      });

      const res = await request(app)
        .get("/admin/me")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe("admin");

      expect(axios.get).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/admin\/me$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer admin_token",
          }),
        })
      );
    });

    it("propagates 403 when user is not admin", async () => {
      mockVerifyOk();

      axios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { success: false, error: "Forbidden" },
        },
      });

      const res = await request(app)
        .get("/admin/me")
        .set("Authorization", "Bearer user_token");

      expect(res.status).toBe(403);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    it("returns 502 when users service is unavailable", async () => {
      mockVerifyOk();

      axios.get.mockRejectedValueOnce(new Error("Service down"));

      const res = await request(app)
        .get("/admin/me")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(502);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Users service unavailable/i);
    });
  });

  describe("GET /admin/users", () => {
    it("returns 401 without token", async () => {
      const res = await request(app).get("/admin/users");

      expect(res.status).toBe(401);
      expect(axios.get).not.toHaveBeenCalled();
    });

    it("returns users list from users service", async () => {
      mockVerifyOk();

      axios.get.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          users: [
            {
              username: "admin",
              email: "admin@test.com",
              role: "admin",
              isRootAdmin: true,
            },
            {
              username: "alice",
              email: "alice@test.com",
              role: "user",
              isRootAdmin: false,
            },
          ],
        },
      });

      const res = await request(app)
        .get("/admin/users")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0]).not.toHaveProperty("password");

      expect(axios.get).toHaveBeenLastCalledWith(
        expect.stringMatching(/\/admin\/users$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer admin_token",
          }),
        })
      );
    });

    it("propagates 403 from users service", async () => {
      mockVerifyOk();

      axios.get.mockRejectedValueOnce({
        response: {
          status: 403,
          data: { success: false, error: "Forbidden" },
        },
      });

      const res = await request(app)
        .get("/admin/users")
        .set("Authorization", "Bearer user_token");

      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/Forbidden/i);
    });
  });

  describe("PATCH /admin/users/:username/role", () => {
    it("returns 400 when username is invalid", async () => {
      const res = await request(app)
        .patch("/admin/users/bad@user/role")
        .set("Authorization", "Bearer admin_token")
        .send({ role: "admin" });

      expect(res.status).toBe(400);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Invalid username/i);
      expect(axios.patch).not.toHaveBeenCalled();
    });

    it("returns 401 without token", async () => {
      const res = await request(app)
        .patch("/admin/users/alice/role")
        .send({ role: "admin" });

      expect(res.status).toBe(401);
      expect(axios.patch).not.toHaveBeenCalled();
    });

    it("forwards role update to users service", async () => {
      axios.patch.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          user: { username: "alice", role: "admin" },
        },
      });

      const res = await request(app)
        .patch("/admin/users/alice/role")
        .set("Authorization", "Bearer admin_token")
        .send({ role: "admin" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.role).toBe("admin");

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\/alice\/role$/),
        { role: "admin" },
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer admin_token",
          }),
        })
      );
    });

    it("forwards demotion to users service", async () => {
      axios.patch.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          user: { username: "bob", role: "user" },
        },
      });

      const res = await request(app)
        .patch("/admin/users/bob/role")
        .set("Authorization", "Bearer admin_token")
        .send({ role: "user" });

      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("user");

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\/bob\/role$/),
        { role: "user" },
        expect.any(Object)
      );
    });

    it("propagates root admin demotion error", async () => {
      axios.patch.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { success: false, error: "Root admin cannot be demoted" },
        },
      });

      const res = await request(app)
        .patch("/admin/users/admin/role")
        .set("Authorization", "Bearer admin_token")
        .send({ role: "user" });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/root admin cannot be demoted/i);
    });

    it("returns 502 when users service is unavailable", async () => {
      axios.patch.mockRejectedValueOnce(new Error("Service down"));

      const res = await request(app)
        .patch("/admin/users/alice/role")
        .set("Authorization", "Bearer admin_token")
        .send({ role: "admin" });

      expect(res.status).toBe(502);
      expect(res.body.error).toMatch(/Users service unavailable/i);
    });
  });

  describe("DELETE /admin/users/:username/history", () => {
    it("returns 400 when username is invalid", async () => {
      const res = await request(app)
        .delete("/admin/users/bad@user/history")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(400);
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it("returns 401 without token", async () => {
      const res = await request(app).delete("/admin/users/alice/history");

      expect(res.status).toBe(401);
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it("forwards history delete to users service", async () => {
      axios.delete.mockResolvedValueOnce({
        status: 200,
        data: { success: true, deletedCount: 3 },
      });

      const res = await request(app)
        .delete("/admin/users/alice/history")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedCount).toBe(3);

      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\/alice\/history$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer admin_token",
          }),
        })
      );
    });

    it("propagates 404 when target user does not exist", async () => {
      axios.delete.mockRejectedValueOnce({
        response: {
          status: 404,
          data: { success: false, error: "User not found" },
        },
      });

      const res = await request(app)
        .delete("/admin/users/missing/history")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/User not found/i);
    });
  });

  describe("DELETE /admin/users/:username", () => {
    it("returns 400 when username is invalid", async () => {
      const res = await request(app)
        .delete("/admin/users/bad@user")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid username/i);
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it("returns 401 without token", async () => {
      const res = await request(app).delete("/admin/users/alice");

      expect(res.status).toBe(401);
      expect(axios.delete).not.toHaveBeenCalled();
    });

    it("forwards user delete to users service", async () => {
      axios.delete.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          message: "User alice deleted",
        },
      });

      const res = await request(app)
        .delete("/admin/users/alice")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/alice deleted/i);

      expect(axios.delete).toHaveBeenCalledWith(
        expect.stringMatching(/\/admin\/users\/alice$/),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer admin_token",
          }),
        })
      );
    });

    it("propagates root admin delete protection", async () => {
      axios.delete.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { success: false, error: "Root admin cannot be deleted" },
        },
      });

      const res = await request(app)
        .delete("/admin/users/admin")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/root admin cannot be deleted/i);
    });

    it("propagates self-delete protection", async () => {
      axios.delete.mockRejectedValueOnce({
        response: {
          status: 400,
          data: { success: false, error: "You cannot delete your own account" },
        },
      });

      const res = await request(app)
        .delete("/admin/users/bob")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete your own account/i);
    });

    it("returns 502 when users service is unavailable", async () => {
      axios.delete.mockRejectedValueOnce(new Error("Service down"));

      const res = await request(app)
        .delete("/admin/users/alice")
        .set("Authorization", "Bearer admin_token");

      expect(res.status).toBe(502);
      expect(res.body.ok).toBe(false);
      expect(res.body.error).toMatch(/Users service unavailable/i);
    });
  });
});