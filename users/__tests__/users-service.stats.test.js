import { describe, it, expect, beforeAll, beforeEach, afterEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

let isConnected = false

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function createUser(username = 'StatsUser') {
    await request(app)
        .post('/createuser')
        .send({ username, password: '123456' })
        .set('Accept', 'application/json')
}

async function createGame(overrides = {}) {
    const defaults = {
        username: 'StatsUser',
        opponent: 'minimax_bot',
        result: 'win',
        boardSize: 7,
        gameMode: 'pvb',
    }
    await request(app)
        .post('/gameresult')
        .send({ ...defaults, ...overrides })
        .set('Accept', 'application/json')
}

// ─── Suite ────────────────────────────────────────────────────────────────────

describe('GET /stats/:username', () => {

    beforeAll(async () => {
        if (!isConnected) {
            await mongoose.connect(process.env.MONGODB_URI)
            isConnected = true
        }
    })

    beforeEach(async () => {
        await mongoose.connection.collections['users']?.deleteMany({})
        await mongoose.connection.collections['gameresults']?.deleteMany({})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        if (isConnected) {
            await mongoose.connection.close()
        }
    })

    // ── 404 ───────────────────────────────────────────────────────────────────

    it('should return 404 when user does not exist', async () => {
        const res = await request(app)
            .get('/stats/NonExistentUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/not found/i)
    })

    // ── Empty stats ───────────────────────────────────────────────────────────

    it('should return empty stats when user exists but has no games', async () => {
        await createUser()

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('username', 'StatsUser')
        expect(res.body.stats.totalGames).toBe(0)
        expect(res.body.stats.wins).toBe(0)
        expect(res.body.stats.losses).toBe(0)
        expect(res.body.stats.winRate).toBe(0)
        expect(res.body.stats.pvbGames).toBe(0)
        expect(res.body.stats.pvpGames).toBe(0)
        expect(res.body.stats.lastFive).toEqual([])
    })

    // ── Win rate calculation ──────────────────────────────────────────────────

    it('should calculate winRate correctly with only wins', async () => {
        await createUser()
        await createGame({ result: 'win' })
        await createGame({ result: 'win' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(2)
        expect(res.body.stats.wins).toBe(2)
        expect(res.body.stats.losses).toBe(0)
        expect(res.body.stats.winRate).toBe(100)
    })

    it('should calculate winRate correctly with only losses', async () => {
        await createUser()
        await createGame({ result: 'loss' })
        await createGame({ result: 'loss' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(2)
        expect(res.body.stats.wins).toBe(0)
        expect(res.body.stats.losses).toBe(2)
        expect(res.body.stats.winRate).toBe(0)
    })

    it('should calculate winRate correctly with mixed results', async () => {
        await createUser()
        await createGame({ result: 'win' })
        await createGame({ result: 'win' })
        await createGame({ result: 'win' })
        await createGame({ result: 'loss' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(4)
        expect(res.body.stats.wins).toBe(3)
        expect(res.body.stats.losses).toBe(1)
        expect(res.body.stats.winRate).toBe(75)
    })

    // ── Game mode breakdown ───────────────────────────────────────────────────

    it('should count pvb and pvp games correctly', async () => {
        await createUser()
        await createGame({ gameMode: 'pvb' })
        await createGame({ gameMode: 'pvb' })
        await createGame({ gameMode: 'pvp' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.pvbGames).toBe(2)
        expect(res.body.stats.pvpGames).toBe(1)
    })

    it('should return pvpGames as 0 when all games are pvb', async () => {
        await createUser()
        await createGame({ gameMode: 'pvb' })
        await createGame({ gameMode: 'pvb' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.pvbGames).toBe(2)
        expect(res.body.stats.pvpGames).toBe(0)
    })

    // ── lastFive ──────────────────────────────────────────────────────────────

    it('should return at most 5 games in lastFive', async () => {
        await createUser()
        for (let i = 0; i < 8; i++) {
            await createGame({ result: i % 2 === 0 ? 'win' : 'loss' })
        }

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(8)
        expect(res.body.stats.lastFive.length).toBe(5)
    })

    it('should return fewer than 5 games in lastFive when total is less than 5', async () => {
        await createUser()
        await createGame({ result: 'win' })
        await createGame({ result: 'loss' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.lastFive.length).toBe(2)
    })

    it('should return correct fields in each lastFive entry', async () => {
        await createUser()
        await createGame({ opponent: 'minimax_bot', result: 'win', boardSize: 9, gameMode: 'pvb' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        const entry = res.body.stats.lastFive[0]
        expect(entry).toHaveProperty('opponent', 'minimax_bot')
        expect(entry).toHaveProperty('result', 'win')
        expect(entry).toHaveProperty('boardSize', 9)
        expect(entry).toHaveProperty('gameMode', 'pvb')
        expect(entry).toHaveProperty('date')
    })

    it('should return lastFive sorted from most recent to oldest', async () => {
        await createUser()
        await createGame({ opponent: 'first_bot' })
        await createGame({ opponent: 'second_bot' })
        await createGame({ opponent: 'third_bot' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        const dates = res.body.stats.lastFive.map(g => new Date(g.date).getTime())
        for (let i = 0; i < dates.length - 1; i++) {
            expect(dates[i]).toBeGreaterThanOrEqual(dates[i + 1])
        }
    })

    // ── Stats are isolated per user ───────────────────────────────────────────

    it('should only return stats for the requested user', async () => {
        await createUser('StatsUser')
        await createUser('OtherUser')
        await createGame({ username: 'StatsUser', result: 'win' })
        await createGame({ username: 'OtherUser', result: 'win' })
        await createGame({ username: 'OtherUser', result: 'win' })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(1)
    })

    // ── 500 error handling ────────────────────────────────────────────────────

    it('should return 500 when a database error occurs on find', async () => {
        await createUser()

        const mockError = new Error('Database connection lost')
        const findSpy = vi.spyOn(mongoose.Model, 'findOne')
            .mockRejectedValueOnce(mockError)
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Internal server error/i)
        expect(consoleErrorSpy).toHaveBeenCalledWith(
            'Error in GET /stats/:username:',
            mockError
        )

        findSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })

    it('should return 500 when a database error occurs on GameResult.find', async () => {
        await createUser()

        const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
            .mockResolvedValueOnce({ username: 'StatsUser' })

        const mockError = new Error('GameResult collection unavailable')
        const findSpy = vi.spyOn(mongoose.Model, 'find')
            .mockRejectedValueOnce(mockError)
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Internal server error/i)

        findOneSpy.mockRestore()
        findSpy.mockRestore()
        consoleErrorSpy.mockRestore()
    })
})
