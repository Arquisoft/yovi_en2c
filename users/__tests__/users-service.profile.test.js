import { describe, it, expect, afterEach, vi } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import app from '../users-service.js';

// ─────────────────────────────────────────────────────────────────────────────
// Shared mock data
// ─────────────────────────────────────────────────────────────────────────────

const mockUserFull = {
    username: 'testuser',
    realName: 'Test User',
    bio: 'I love board games',
    location: { city: 'Oviedo', country: 'Spain' },
    preferredLanguage: 'en',
    createdAt: new Date('2024-01-01'),
    save: vi.fn().mockResolvedValue(true),
};

const mockUserMinimal = {
    username: 'minimaluser',
    realName: null,
    bio: null,
    location: {},
    preferredLanguage: 'en',
    createdAt: new Date('2024-06-01'),
    save: vi.fn().mockResolvedValue(true),
};

const mockGames = [
    { result: 'win',  opponent: 'minimax_bot', boardSize: 7,  gameMode: 'pvb', date: new Date() },
    { result: 'loss', opponent: 'alfa_beta',   boardSize: 11, gameMode: 'pvb', date: new Date() },
    { result: 'win',  opponent: 'player2',     boardSize: 7,  gameMode: 'pvp', date: new Date() },
];

// ─────────────────────────────────────────────────────────────────────────────
// GET /profile/:username
// ─────────────────────────────────────────────────────────────────────────────

describe('GET /profile/:username', () => {

    afterEach(() => vi.restoreAllMocks());

    // ── Happy path ────────────────────────────────────────────────────────────

    it('returns 200 with full profile data', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserFull);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(mockGames),
        });

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.profile.username).toBe('testuser');
        expect(res.body.profile.realName).toBe('Test User');
        expect(res.body.profile.bio).toBe('I love board games');
        expect(res.body.profile.location).toMatchObject({ city: 'Oviedo', country: 'Spain' });
        expect(res.body.profile.preferredLanguage).toBe('en');
        expect(res.body.profile).toHaveProperty('joinDate');
    });

    it('returns correct aggregated stats', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserFull);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(mockGames),
        });

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(200);
        const { stats } = res.body.profile;
        expect(stats.totalGames).toBe(3);
        expect(stats.wins).toBe(2);
        expect(stats.losses).toBe(1);
        expect(stats.winRate).toBe(67);
    });

    it('returns up to 5 recent matches with correct fields', async () => {
        const manyGames = Array.from({ length: 8 }, (_, i) => ({
            result: i % 2 === 0 ? 'win' : 'loss',
            opponent: 'bot',
            boardSize: 7,
            gameMode: 'pvb',
            date: new Date(),
        }));
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserFull);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(manyGames),
        });

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(200);
        expect(res.body.profile.recentMatches).toHaveLength(5);
        const match = res.body.profile.recentMatches[0];
        expect(match).toHaveProperty('opponent');
        expect(match).toHaveProperty('result');
        expect(match).toHaveProperty('boardSize');
        expect(match).toHaveProperty('gameMode');
        expect(match).toHaveProperty('date');
    });

    it('returns empty recentMatches and zero stats when user has no games', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserFull);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(200);
        expect(res.body.profile.recentMatches).toHaveLength(0);
        expect(res.body.profile.stats.totalGames).toBe(0);
        expect(res.body.profile.stats.winRate).toBe(0);
    });

    it('returns null for optional fields when user has no bio or realName', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserMinimal);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/minimaluser');

        expect(res.status).toBe(200);
        expect(res.body.profile.realName).toBeNull();
        expect(res.body.profile.bio).toBeNull();
    });

    // ── Security: password never exposed ─────────────────────────────────────

    it('never exposes the password hash', async () => {
        // Simulate a user object that somehow still has password
        const userWithPassword = { ...mockUserFull, password: 'hashed_secret' };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(userWithPassword);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([]),
        });

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(200);
        expect(res.body.profile).not.toHaveProperty('password');
        // Also verify it's not nested anywhere in the response
        expect(JSON.stringify(res.body)).not.toContain('hashed_secret');
    });

    // ── 404 ───────────────────────────────────────────────────────────────────

    it('returns 404 when user does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null);

        const res = await request(app).get('/profile/nobody');

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    // ── 500 ───────────────────────────────────────────────────────────────────

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/internal server error/i);
    });

    it('returns 500 when GameResult.find throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(mockUserFull);
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockRejectedValueOnce(new Error('DB error')),
        });
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app).get('/profile/testuser');

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});

// ─────────────────────────────────────────────────────────────────────────────
// PATCH /profile/:username
// ─────────────────────────────────────────────────────────────────────────────

describe('PATCH /profile/:username', () => {

    afterEach(() => vi.restoreAllMocks());

    // ── Happy path: full update ───────────────────────────────────────────────

    it('returns 200 and updated profile when all fields are provided', async () => {
        const savedUser = { ...mockUserFull, save: vi.fn().mockResolvedValue(true) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .patch('/profile/testuser')
            .send({
                realName: 'Updated Name',
                bio: 'New bio text',
                city: 'Madrid',
                country: 'Spain',
                preferredLanguage: 'es',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(savedUser.save).toHaveBeenCalledTimes(1);
        expect(res.body.profile).not.toHaveProperty('password');
    });

    it('only updates fields that are explicitly sent', async () => {
        const savedUser = { ...mockUserFull, save: vi.fn().mockResolvedValue(true) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        await request(app)
            .patch('/profile/testuser')
            .send({ bio: 'Only bio updated' });

        expect(savedUser.bio).toBe('Only bio updated');
        // realName should remain unchanged
        expect(savedUser.realName).toBe('Test User');
    });

    it('accepts partial update with only city', async () => {
        const savedUser = { ...mockUserFull, save: vi.fn().mockResolvedValue(true) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ city: 'Barcelona' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
    });

    it('accepts preferredLanguage update to es', async () => {
        const savedUser = { ...mockUserFull, save: vi.fn().mockResolvedValue(true) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ preferredLanguage: 'es' });

        expect(res.status).toBe(200);
        expect(savedUser.preferredLanguage).toBe('es');
    });

    it('does not expose password in PATCH response', async () => {
        const savedUser = { ...mockUserFull, password: 'hashed_secret',
            save: vi.fn().mockResolvedValue(true) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ bio: 'test' });

        expect(res.body.profile).not.toHaveProperty('password');
        expect(JSON.stringify(res.body)).not.toContain('hashed_secret');
    });

    // ── 404 ───────────────────────────────────────────────────────────────────

    it('returns 404 when user does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null);

        const res = await request(app)
            .patch('/profile/nobody')
            .send({ bio: 'test' });

        expect(res.status).toBe(404);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/not found/i);
    });

    // ── Validation errors ─────────────────────────────────────────────────────

    it('returns 400 when save throws a ValidationError', async () => {
        const validationError = new mongoose.Error.ValidationError();
        validationError.errors = {
            bio: new mongoose.Error.ValidatorError({
                message: 'Bio must be at most 280 characters',
                path: 'bio',
            }),
        };
        const savedUser = { ...mockUserFull,
            save: vi.fn().mockRejectedValueOnce(validationError) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ bio: 'x'.repeat(300) });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/280 characters/i);
    });

    // ── 500 ───────────────────────────────────────────────────────────────────

    it('returns 500 when findOne throws', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(new Error('DB error'));
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ bio: 'test' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toMatch(/internal server error/i);
    });

    it('returns 500 when save throws a non-validation error', async () => {
        const savedUser = { ...mockUserFull,
            save: vi.fn().mockRejectedValueOnce(new Error('Disk full')) };
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(savedUser);
        vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .patch('/profile/testuser')
            .send({ bio: 'test' });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });
});