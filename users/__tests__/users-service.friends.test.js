import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../users-service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Token helper
// users-service.js reads the JWT payload without verifying the signature.
// We build a structurally valid token (header.payload.sig) so the service
// can base64url-decode the payload and extract `username`.
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
// GET /search
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /search', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 400 when q parameter is missing', async () => {
        const res = await request(app).get('/search');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/q is required/i);
    });

    it('returns 400 when q is an empty string', async () => {
        const res = await request(app).get('/search?q=');
        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    it('returns 200 and matching users on a valid query', async () => {
        const users = [
            { username: 'maria99', email: 'maria@example.com', realName: 'Maria' },
        ];
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce(users),
        });

        const res = await request(app).get('/search?q=maria');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(1);
        expect(res.body.users[0].username).toBe('maria99');
    });

    it('never exposes password or friendRequests in results', async () => {
        const users = [{
            username: 'u1', email: 'u1@test.com', realName: null,
            password: 'hashed_secret', friendRequests: ['someone'],
        }];
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce(users),
        });

        const res = await request(app).get('/search?q=u1');

        expect(JSON.stringify(res.body)).not.toContain('hashed_secret');
        res.body.users.forEach(u => {
            expect(u).not.toHaveProperty('password');
            expect(u).not.toHaveProperty('friendRequests');
        });
    });

    it('returns empty array when no users match', async () => {
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            limit: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/search?q=zzznobody');

        expect(res.status).toBe(200);
        expect(res.body.count).toBe(0);
        expect(res.body.users).toEqual([]);
    });

    it('returns 500 when database throws', async () => {
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            limit: vi.fn().mockRejectedValueOnce(new Error('DB error')),
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app).get('/search?q=test');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/internal server error/i);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /friends/request/:username
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /friends/request/:username', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).post('/friends/request/bob');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/unauthorized/i);
    });

    it('returns 401 when token cannot be decoded', async () => {
        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', 'Bearer not.valid');
        expect(res.status).toBe(401);
    });

    it('returns 400 when sender and target are the same user', async () => {
        const res = await request(app)
            .post('/friends/request/alice')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(400);
        expect(res.body.error).toMatch(/yourself/i);
    });

    it('returns 404 when target user does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/friends/request/nobody')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/not found/i);
    });

    it('returns 409 when they are already friends', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            friends: ['alice'],
            friendRequests: [],
            save: vi.fn(),
        });

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already friends/i);
    });

    it('returns 409 when a request is already pending', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            friends: [],
            friendRequests: ['alice'],
            save: vi.fn(),
        });

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(409);
        expect(res.body.error).toMatch(/already sent/i);
    });

    it('returns 201 and adds sender to target friendRequests on success', async () => {
        const targetUser = {
            username: 'bob',
            friends: [],
            friendRequests: [],
            save: vi.fn().mockResolvedValue(true),
        };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(targetUser);

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(targetUser.friendRequests).toContain('alice');
        expect(targetUser.save).toHaveBeenCalledTimes(1);
    });

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });

    it('returns 500 when save throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            friends: [],
            friendRequests: [],
            save: vi.fn().mockRejectedValueOnce(new Error('Disk full')),
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/friends/request/bob')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// POST /friends/accept/:username
// ─────────────────────────────────────────────────────────────────────────────

describe('POST /friends/accept/:username', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).post('/friends/accept/alice');
        expect(res.status).toBe(401);
    });

    it('returns 404 when acceptor user is not found in DB', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/acceptor user not found/i);
    });

    it('returns 404 when there is no pending request from that user', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            username: 'bob',
            friends: [],
            friendRequests: [],
            save: vi.fn(),
        });

        const res = await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/no pending request/i);
    });

    it('returns 404 when sender user does not exist in DB', async () => {
        vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce({
                username: 'bob', friends: [], friendRequests: ['alice'], save: vi.fn(),
            })
            .mockResolvedValueOnce(null);

        const res = await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/alice not found/i);
    });

    it('returns 200, moves sender to friends, and saves both users', async () => {
        const acceptor = {
            username: 'bob', friends: [], friendRequests: ['alice'],
            save: vi.fn().mockResolvedValue(true),
        };
        const sender = {
            username: 'alice', friends: [],
            save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce(acceptor)
            .mockResolvedValueOnce(sender);

        const res = await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(acceptor.friendRequests).not.toContain('alice');
        expect(acceptor.friends).toContain('alice');
        expect(sender.friends).toContain('bob');
        expect(acceptor.save).toHaveBeenCalledTimes(1);
        expect(sender.save).toHaveBeenCalledTimes(1);
    });

    it('does not add duplicate entries when already in friends', async () => {
        const acceptor = {
            username: 'bob', friends: ['alice'], friendRequests: ['alice'],
            save: vi.fn().mockResolvedValue(true),
        };
        const sender = {
            username: 'alice', friends: ['bob'],
            save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce(acceptor)
            .mockResolvedValueOnce(sender);

        await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(acceptor.friends.filter(u => u === 'alice').length).toBe(1);
        expect(sender.friends.filter(u => u === 'bob').length).toBe(1);
    });

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/friends/accept/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// DELETE /friends/:username
// ─────────────────────────────────────────────────────────────────────────────

describe('DELETE /friends/:username', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).delete('/friends/alice');
        expect(res.status).toBe(401);
    });

    it('returns 404 when either user is not found', async () => {
        vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);

        const res = await request(app)
            .delete('/friends/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/user not found/i);
    });

    it('removes each user from the other friends array bidirectionally', async () => {
        const current = {
            username: 'bob', friends: ['alice', 'carol'],
            save: vi.fn().mockResolvedValue(true),
        };
        const target = {
            username: 'alice', friends: ['bob', 'carol'],
            save: vi.fn().mockResolvedValue(true),
        };

        vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce(current)
            .mockResolvedValueOnce(target);

        const res = await request(app)
            .delete('/friends/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(current.friends).not.toContain('alice');
        expect(current.friends).toContain('carol');
        expect(target.friends).not.toContain('bob');
        expect(target.friends).toContain('carol');
    });

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .delete('/friends/alice')
            .set('Authorization', authHeader('bob'));

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /friends
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /friends', () => {

    afterEach(() => vi.restoreAllMocks());

    it('returns 401 when Authorization header is missing', async () => {
        const res = await request(app).get('/friends');
        expect(res.status).toBe(401);
    });

    it('returns 404 when the user is not found', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null);

        const res = await request(app)
            .get('/friends')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(404);
        expect(res.body.error).toMatch(/user not found/i);
    });

    it('returns 200 with the friends array', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ friends: ['bob', 'carol'] });

        const res = await request(app)
            .get('/friends')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.friends).toEqual(['bob', 'carol']);
    });

    it('returns 200 with an empty array when user has no friends', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ friends: [] });

        const res = await request(app)
            .get('/friends')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(200);
        expect(res.body.friends).toEqual([]);
    });

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .get('/friends')
            .set('Authorization', authHeader('alice'));

        expect(res.status).toBe(500);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /profile/:username — friends & friendRequests fields
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /profile/:username — friends fields in response', () => {

    afterEach(() => vi.restoreAllMocks());

    it('includes friends array in the profile response', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            username: 'alice', friends: ['bob'], friendRequests: [], createdAt: new Date(),
        });
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/alice');

        expect(res.status).toBe(200);
        expect(res.body.profile).toHaveProperty('friends');
        expect(res.body.profile.friends).toContain('bob');
    });

    it('includes friendRequests array in the profile response', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            username: 'alice', friends: [], friendRequests: ['carol'], createdAt: new Date(),
        });
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/alice');

        expect(res.status).toBe(200);
        expect(res.body.profile).toHaveProperty('friendRequests');
        expect(res.body.profile.friendRequests).toContain('carol');
    });

    it('defaults to empty arrays when fields are undefined', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({
            username: 'alice', friends: undefined, friendRequests: undefined, createdAt: new Date(),
        });
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/alice');

        expect(res.status).toBe(200);
        expect(res.body.profile.friends).toEqual([]);
        expect(res.body.profile.friendRequests).toEqual([]);
    });
});
