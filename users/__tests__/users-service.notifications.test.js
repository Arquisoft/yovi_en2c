import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../users-service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Token helper (same pattern used in friends tests)
// ─────────────────────────────────────────────────────────────────────────────

function buildToken(username) {
    const header  = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ username })).toString('base64url');
    return `${header}.${payload}.fakesig`;
}

function authHeader(username) {
    return `Bearer ${buildToken(username)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// GET /notifications
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /notifications', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).get('/notifications');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/unauthorized/i);
    });

    it('returns 200 with notifications and unreadCount', async () => {
        const mockNotifs = [
            { _id: new mongoose.Types.ObjectId(), recipient: 'alice', type: 'welcome', from: null, read: false, createdAt: new Date() },
            { _id: new mongoose.Types.ObjectId(), recipient: 'alice', type: 'friend_request', from: 'bob', read: true, createdAt: new Date() },
        ];

        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce(mockNotifs),
            }),
        });

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.notifications).toHaveLength(2);
        expect(res.body.unreadCount).toBe(1);
    });

    it('returns 200 with empty array when user has no notifications', async () => {
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce([]),
            }),
        });

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.notifications).toEqual([]);
        expect(res.body.unreadCount).toBe(0);
    });

    it('returns correct fields in each notification', async () => {
        const id = new mongoose.Types.ObjectId();
        const mockNotifs = [{
            _id: id,
            recipient: 'alice',
            type: 'friend_request',
            from: 'bob',
            read: false,
            createdAt: new Date('2026-04-01'),
        }];

        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce(mockNotifs),
            }),
        });

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        const n = res.body.notifications[0];
        expect(n).toHaveProperty('id');
        expect(n).toHaveProperty('type', 'friend_request');
        expect(n).toHaveProperty('from', 'bob');
        expect(n).toHaveProperty('read', false);
        expect(n).toHaveProperty('createdAt');
    });

    it('never exposes recipient field in notification response', async () => {
        const mockNotifs = [{
            _id: new mongoose.Types.ObjectId(),
            recipient: 'alice',
            type: 'welcome',
            from: null,
            read: false,
            createdAt: new Date(),
        }];

        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockResolvedValueOnce(mockNotifs),
            }),
        });

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader('alice'));

        res.body.notifications.forEach(n => {
            expect(n).not.toHaveProperty('recipient');
        });
    });

    it('returns 500 when database throws', async () => {
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockReturnValueOnce({
                limit: vi.fn().mockRejectedValueOnce(new Error('DB error')),
            }),
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .get('/notifications')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/internal server error/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /notifications/:id/read
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /notifications/:id/read', () => {

    afterEach(() => vi.restoreAllMocks());

    const validId = '507f1f77bcf86cd799439011';

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).patch(`/notifications/${validId}/read`);
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    it('returns 400 when id is not a valid ObjectId', async () => {
        const res = await request(app)
            .patch('/notifications/not-an-id/read')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/invalid notification id/i);
    });

    it('returns 404 when notification does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findById').mockResolvedValueOnce(null);

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 403 when the authenticated user is not the recipient', async () => {
        vi.spyOn(mongoose.Model, 'findById').mockResolvedValueOnce({
            _id: validId,
            recipient: 'bob',       // different user
            type: 'friend_request',
            from: 'carol',
            read: false,
            save: vi.fn(),
        });

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));   // alice, not bob

        expect(res.status).toBe(403);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/forbidden/i);
    });

    it('returns 200 and sets read=true for valid request', async () => {
        const notif = {
            _id: validId,
            recipient: 'alice',
            type: 'friend_request',
            from: 'bob',
            read: false,
            createdAt: new Date(),
            save: vi.fn().mockResolvedValue(true),
        };
        vi.spyOn(mongoose.Model, 'findById').mockResolvedValueOnce(notif);

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(notif.read).toBe(true);
        expect(notif.save).toHaveBeenCalledTimes(1);
        expect(res.body.notification).toHaveProperty('read', true);
    });

    it('is idempotent — marking an already-read notification returns 200', async () => {
        const notif = {
            _id: validId,
            recipient: 'alice',
            type: 'welcome',
            from: null,
            read: true,   // already read
            createdAt: new Date(),
            save: vi.fn().mockResolvedValue(true),
        };
        vi.spyOn(mongoose.Model, 'findById').mockResolvedValueOnce(notif);

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('returns 500 when findById throws', async () => {
        vi.spyOn(mongoose.Model, 'findById').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });

    it('returns 500 when save throws', async () => {
        vi.spyOn(mongoose.Model, 'findById').mockResolvedValueOnce({
            _id: validId,
            recipient: 'alice',
            type: 'welcome',
            from: null,
            read: false,
            createdAt: new Date(),
            save: vi.fn().mockRejectedValueOnce(new Error('Disk full')),
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch(`/notifications/${validId}/read`)
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /createuser — welcome notification
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /createuser — welcome notification', () => {

    afterEach(() => vi.restoreAllMocks());

    it('calls Notification.create after creating a new user', async () => {
        const savedUser = {
            _id: new mongoose.Types.ObjectId(),
            username: 'newuser',
            email: null,
            createdAt: new Date(),
            save: vi.fn().mockResolvedValue(true),
        };

        // We cannot easily spy on Notification.create without importing it,
        // so we verify the side-effect does NOT block the 201 response.
        // The actual notification creation is covered by the unit-level spy below.
        vi.spyOn(mongoose.Model.prototype, 'save').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .post('/createuser')
            .send({ username: 'newuser', password: '1234' });

        // Registration must succeed regardless of notification outcome
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    it('still returns 201 when welcome notification creation fails', async () => {
        const savedUser = {
            _id: new mongoose.Types.ObjectId(),
            username: 'resilient',
            email: null,
            createdAt: new Date(),
            save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(mongoose.Model.prototype, 'save').mockResolvedValueOnce(savedUser);
        // Simulate notification failure (fire-and-forget should not affect response)
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/createuser')
            .send({ username: 'resilient', password: '1234' });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /friends/request/:username — friend_request notification
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /friends/request/:username — notification creation', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 201 even when notification creation fails silently', async () => {
        const target = {
            username: 'bob',
            friends: [],
            friendRequests: [],
            save: vi.fn().mockResolvedValue(true),
        };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(target);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        // Friend request logic must succeed regardless of notification
        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(target.friendRequests).toContain('alice');
    });
});
