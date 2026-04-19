import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

describe('GET /stats/:username', () => {

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── 404: user not found ───────────────────────────────────────────────────

    it('should return 404 when user does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        const res = await request(app)
            .get('/stats/NonExistentUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/not found/i)
    })

    // ── Empty stats ───────────────────────────────────────────────────────────

    it('should return empty stats when user has no games', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce([])
        })

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

    // ── winRate: only wins ────────────────────────────────────────────────────

    it('should calculate winRate as 100 when all games are wins', async () => {
        const games = [
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(2)
        expect(res.body.stats.wins).toBe(2)
        expect(res.body.stats.losses).toBe(0)
        expect(res.body.stats.winRate).toBe(100)
    })

    // ── winRate: only losses ──────────────────────────────────────────────────

    it('should calculate winRate as 0 when all games are losses', async () => {
        const games = [
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(2)
        expect(res.body.stats.wins).toBe(0)
        expect(res.body.stats.losses).toBe(2)
        expect(res.body.stats.winRate).toBe(0)
    })

    // ── winRate: mixed ────────────────────────────────────────────────────────

    it('should calculate winRate correctly with mixed results', async () => {
        const games = [
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(4)
        expect(res.body.stats.wins).toBe(3)
        expect(res.body.stats.losses).toBe(1)
        expect(res.body.stats.winRate).toBe(75)
    })

    // ── pvb / pvp breakdown ───────────────────────────────────────────────────

    it('should count pvb and pvp games correctly', async () => {
        const games = [
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot',    date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot',    date: new Date() },
            { result: 'loss', gameMode: 'pvp', boardSize: 7, opponent: 'carlos', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.pvbGames).toBe(2)
        expect(res.body.stats.pvpGames).toBe(1)
    })

    it('should return pvpGames as 0 when all games are pvb', async () => {
        const games = [
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.pvbGames).toBe(2)
        expect(res.body.stats.pvpGames).toBe(0)
    })

    // ── lastFive ──────────────────────────────────────────────────────────────

    it('should return at most 5 games in lastFive when total is more than 5', async () => {
        const games = Array.from({ length: 8 }, (_, i) => ({
            result: i % 2 === 0 ? 'win' : 'loss',
            gameMode: 'pvb',
            boardSize: 7,
            opponent: 'bot',
            date: new Date(Date.now() - i * 1000),
        }))
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.totalGames).toBe(8)
        expect(res.body.stats.lastFive.length).toBe(5)
    })

    it('should return all games in lastFive when total is less than 5', async () => {
        const games = [
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(200)
        expect(res.body.stats.lastFive.length).toBe(2)
    })

    it('should return correct fields in each lastFive entry', async () => {
        const date = new Date('2026-04-13T10:00:00Z')
        const games = [
            { result: 'win', gameMode: 'pvb', boardSize: 9, opponent: 'minimax_bot', date },
        ]
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockResolvedValueOnce(games)
        })

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

    // ── 500: error handling ───────────────────────────────────────────────────

    it('should return 500 when findOne throws a database error', async () => {
        const mockError = new Error('Database connection lost')
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(mockError)
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
    })

    it('should return 500 when GameResult.find throws a database error', async () => {
        const mockError = new Error('GameResult collection unavailable')
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockRejectedValueOnce(mockError)
        })
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const res = await request(app)
            .get('/stats/StatsUser')
            .set('Accept', 'application/json')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Internal server error/i)
    })
})