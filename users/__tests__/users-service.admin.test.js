import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../users-service.js';

function buildToken(username) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ username })).toString('base64url');
  return `${header}.${payload}.fakesig`;
}

function authHeader(username) {
  return `Bearer ${buildToken(username)}`;
}

const adminUser = {
  _id: new mongoose.Types.ObjectId(),
  username: 'admin',
  email: 'admin@test.com',
  role: 'admin',
  createdAt: new Date(),
};

const normalUser = {
  _id: new mongoose.Types.ObjectId(),
  username: 'alice',
  email: 'alice@test.com',
  realName: 'Alice',
  role: 'user',
  createdAt: new Date(),
};

describe('Admin endpoints', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('GET /admin/me', () => {
    it('returns 401 without token', async () => {
      const res = await request(app).get('/admin/me');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/unauthorized/i);
    });

    it('returns 403 when authenticated user is not admin', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
        username: 'alice',
        role: 'user',
      });

      const res = await request(app)
        .get('/admin/me')
        .set('Authorization', authHeader('alice'));

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/forbidden/i);
    });

    it('returns current admin public data', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(adminUser);

      const res = await request(app)
        .get('/admin/me')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.user.username).toBe('admin');
      expect(res.body.user.role).toBe('admin');
      expect(res.body.user.isRootAdmin).toBe(true);
      expect(res.body.user).not.toHaveProperty('password');
    });
  });

  describe('GET /admin/users', () => {
    it('returns 403 for non-admin users', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
        username: 'alice',
        role: 'user',
      });

      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', authHeader('alice'));

      expect(res.status).toBe(403);
    });

    it('returns all users with role and root admin flag', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(adminUser);

      vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
        sort: vi.fn().mockResolvedValueOnce([
          adminUser,
          normalUser,
        ]),
      });

      const res = await request(app)
        .get('/admin/users')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.users).toHaveLength(2);
      expect(res.body.users[0]).not.toHaveProperty('password');
      expect(res.body.users.find((u) => u.username === 'admin').isRootAdmin).toBe(true);
      expect(res.body.users.find((u) => u.username === 'alice').role).toBe('user');
    });
  });

  describe('PATCH /admin/users/:username/role', () => {
    it('returns 400 for invalid role', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(adminUser);

      const res = await request(app)
        .patch('/admin/users/alice/role')
        .set('Authorization', authHeader('admin'))
        .send({ role: 'superadmin' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/invalid payload/i);
    });

    it('does not allow demoting root admin', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(adminUser);

      const res = await request(app)
        .patch('/admin/users/admin/role')
        .set('Authorization', authHeader('admin'))
        .send({ role: 'user' });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/root admin cannot be demoted/i);
    });

    it('returns 404 when target user does not exist', async () => {
      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .patch('/admin/users/missing/role')
        .set('Authorization', authHeader('admin'))
        .send({ role: 'admin' });

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    it('promotes user to admin and creates admin_granted notification', async () => {
      const target = {
        ...normalUser,
        role: 'user',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(target);

      const createSpy = vi.spyOn(mongoose.Model, 'create').mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/admin/users/alice/role')
        .set('Authorization', authHeader('admin'))
        .send({ role: 'admin' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(target.role).toBe('admin');
      expect(target.save).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        recipient: 'alice',
        type: 'admin_granted',
        from: 'admin',
        read: false,
      }));
    });

    it('demotes admin to user and creates admin_revoked notification', async () => {
      const target = {
        ...normalUser,
        username: 'bob',
        role: 'admin',
        save: vi.fn().mockResolvedValue(true),
      };

      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(target);

      const createSpy = vi.spyOn(mongoose.Model, 'create').mockResolvedValueOnce({});

      const res = await request(app)
        .patch('/admin/users/bob/role')
        .set('Authorization', authHeader('admin'))
        .send({ role: 'user' });

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(res.status).toBe(200);
      expect(target.role).toBe('user');
      expect(createSpy).toHaveBeenCalledWith(expect.objectContaining({
        recipient: 'bob',
        type: 'admin_revoked',
        from: 'admin',
      }));
    });
  });

  describe('DELETE /admin/users/:username/history', () => {
    it('returns 404 when target user does not exist', async () => {
      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/admin/users/missing/history')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    it('deletes only the target user game history', async () => {
      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(normalUser);

      const deleteManySpy = vi
        .spyOn(mongoose.Model, 'deleteMany')
        .mockResolvedValueOnce({ deletedCount: 3 });

      const res = await request(app)
        .delete('/admin/users/alice/history')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.deletedCount).toBe(3);
      expect(deleteManySpy).toHaveBeenCalledWith({ username: { $eq: 'alice' } });
    });
  });

  describe('DELETE /admin/users/:username', () => {
    it('does not allow deleting root admin', async () => {
      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(adminUser);

      const res = await request(app)
        .delete('/admin/users/admin')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/root admin cannot be deleted/i);
    });

    it('does not allow deleting your own account', async () => {
      const bobAdmin = {
        ...adminUser,
        username: 'bob',
        role: 'admin',
      };

      vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(bobAdmin);

      const res = await request(app)
        .delete('/admin/users/bob')
        .set('Authorization', authHeader('bob'));

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/cannot delete your own account/i);
    });

    it('returns 404 when target user does not exist', async () => {
      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(null);

      const res = await request(app)
        .delete('/admin/users/missing')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(404);
      expect(res.body.error).toMatch(/user not found/i);
    });

    it('deletes user, their game results, and their notifications', async () => {
      vi.spyOn(mongoose.Model, 'findOne')
        .mockResolvedValueOnce(adminUser)
        .mockResolvedValueOnce(normalUser);

      const deleteOneSpy = vi
        .spyOn(mongoose.Model, 'deleteOne')
        .mockResolvedValueOnce({ deletedCount: 1 });

      const deleteManySpy = vi
        .spyOn(mongoose.Model, 'deleteMany')
        .mockResolvedValue({ deletedCount: 2 });

      const res = await request(app)
        .delete('/admin/users/alice')
        .set('Authorization', authHeader('admin'));

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toMatch(/alice deleted/i);

      expect(deleteOneSpy).toHaveBeenCalledWith({ username: { $eq: 'alice' } });
      expect(deleteManySpy).toHaveBeenCalledWith({ username: { $eq: 'alice' } });
      expect(deleteManySpy).toHaveBeenCalledWith({ recipient: { $eq: 'alice' } });
    });
  });
});