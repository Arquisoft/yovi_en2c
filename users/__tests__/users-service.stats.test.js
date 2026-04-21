import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeGames(count) {
    return Array.from({ length: count }, (_, i) => ({
        result:   i % 2 === 0 ? 'win' : 'loss',
        gameMode: i % 3 === 0 ? 'pvp' : 'pvb',
        boardSize: 7,
        opponent: 'bot',
        date: new Date(Date.now() - i * 1000),
    }))
}

function mockUser() {
    vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce({ username: 'StatsUser' })
}

function mockGames(games) {
    vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
        sort: vi.fn().mockResolvedValueOnce(games),
    })
}

// ─────────────────────────────────────────────────────────────────────────────

describe('GET /stats/:username', () => {

    afterEach(() => vi.restoreAllMocks())

    // ── 404 ───────────────────────────────────────────────────────────────────

    it('returns 404 when user does not exist', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        const res = await request(app).get('/stats/NonExistentUser')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/not found/i)
    })

    // ── Aggregated stats: empty ───────────────────────────────────────────────

    it('returns zero stats and empty arrays when user has no games', async () => {
        mockUser()
        mockGames([])

        const res = await request(app).get('/stats/StatsUser')

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
        // pagination fields present even when empty
        expect(res.body.games).toEqual([])
        expect(res.body.page).toBe(1)
        expect(res.body.pageSize).toBe(10)
    })

    // ── Aggregated stats: winRate ─────────────────────────────────────────────

    it('calculates winRate as 100 when all games are wins', async () => {
        mockUser()
        mockGames([
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ])

        const res = await request(app).get('/stats/StatsUser')

        expect(res.status).toBe(200)
        expect(res.body.stats.wins).toBe(2)
        expect(res.body.stats.losses).toBe(0)
        expect(res.body.stats.winRate).toBe(100)
    })

    it('calculates winRate as 0 when all games are losses', async () => {
        mockUser()
        mockGames([
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ])

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.stats.wins).toBe(0)
        expect(res.body.stats.losses).toBe(2)
        expect(res.body.stats.winRate).toBe(0)
    })

    it('calculates winRate correctly with mixed results (75%)', async () => {
        mockUser()
        mockGames([
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
            { result: 'loss', gameMode: 'pvb', boardSize: 7, opponent: 'bot', date: new Date() },
        ])

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.stats.totalGames).toBe(4)
        expect(res.body.stats.winRate).toBe(75)
    })

    // ── Aggregated stats: pvb/pvp breakdown ───────────────────────────────────

    it('counts pvb and pvp games correctly', async () => {
        mockUser()
        mockGames([
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot',    date: new Date() },
            { result: 'win',  gameMode: 'pvb', boardSize: 7, opponent: 'bot',    date: new Date() },
            { result: 'loss', gameMode: 'pvp', boardSize: 7, opponent: 'carlos', date: new Date() },
        ])

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.stats.pvbGames).toBe(2)
        expect(res.body.stats.pvpGames).toBe(1)
    })

    // ── lastFive (backwards compatibility) ───────────────────────────────────

    it('returns at most 5 games in lastFive when total > 5', async () => {
        mockUser()
        mockGames(makeGames(8))

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.stats.totalGames).toBe(8)
        expect(res.body.stats.lastFive.length).toBe(5)
    })

    it('returns all games in lastFive when total < 5', async () => {
        mockUser()
        mockGames(makeGames(2))

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.stats.lastFive.length).toBe(2)
    })

    it('returns correct fields in each lastFive entry', async () => {
        const date = new Date('2026-04-13T10:00:00Z')
        mockUser()
        mockGames([{ result: 'win', gameMode: 'pvb', boardSize: 9, opponent: 'minimax_bot', date }])

        const res = await request(app).get('/stats/StatsUser')

        const entry = res.body.stats.lastFive[0]
        expect(entry).toHaveProperty('opponent', 'minimax_bot')
        expect(entry).toHaveProperty('result', 'win')
        expect(entry).toHaveProperty('boardSize', 9)
        expect(entry).toHaveProperty('gameMode', 'pvb')
        expect(entry).toHaveProperty('date')
    })

    // ── Pagination: response shape ────────────────────────────────────────────

    it('returns games, page and pageSize fields in response', async () => {
        mockUser()
        mockGames(makeGames(3))

        const res = await request(app).get('/stats/StatsUser')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('games')
        expect(res.body).toHaveProperty('page')
        expect(res.body).toHaveProperty('pageSize')
        expect(Array.isArray(res.body.games)).toBe(true)
    })

    it('returns correct fields in each games entry', async () => {
        const date = new Date('2026-04-13T10:00:00Z')
        mockUser()
        mockGames([{ result: 'win', gameMode: 'pvb', boardSize: 9, opponent: 'minimax_bot', date }])

        const res = await request(app).get('/stats/StatsUser')

        const entry = res.body.games[0]
        expect(entry).toHaveProperty('opponent', 'minimax_bot')
        expect(entry).toHaveProperty('result', 'win')
        expect(entry).toHaveProperty('boardSize', 9)
        expect(entry).toHaveProperty('gameMode', 'pvb')
        expect(entry).toHaveProperty('date')
    })

    // ── Pagination: page 1 (default) ──────────────────────────────────────────

    it('defaults to page 1 and pageSize 10 when no query params sent', async () => {
        mockUser()
        mockGames(makeGames(25))

        const res = await request(app).get('/stats/StatsUser')

        expect(res.body.page).toBe(1)
        expect(res.body.pageSize).toBe(10)
        expect(res.body.games.length).toBe(10)
    })

    it('returns first 10 games on page 1 with 25 total games', async () => {
        mockUser()
        mockGames(makeGames(25))

        const res = await request(app).get('/stats/StatsUser?page=1&pageSize=10')

        expect(res.body.games.length).toBe(10)
        expect(res.body.page).toBe(1)
        expect(res.body.stats.totalGames).toBe(25)
    })

    // ── Pagination: page 2 ────────────────────────────────────────────────────

    it('returns correct slice on page 2', async () => {
        mockUser()
        mockGames(makeGames(25))

        const res = await request(app).get('/stats/StatsUser?page=2&pageSize=10')

        expect(res.body.page).toBe(2)
        expect(res.body.games.length).toBe(10)
    })

    // ── Pagination: last page ─────────────────────────────────────────────────

    it('returns remaining games on last page', async () => {
        mockUser()
        mockGames(makeGames(25))

        const res = await request(app).get('/stats/StatsUser?page=3&pageSize=10')

        expect(res.body.page).toBe(3)
        expect(res.body.games.length).toBe(5) // 25 - 20 = 5 remaining
    })

    // ── Pagination: beyond last page ──────────────────────────────────────────

    it('returns empty games array when page exceeds total pages', async () => {
        mockUser()
        mockGames(makeGames(5))

        const res = await request(app).get('/stats/StatsUser?page=99&pageSize=10')

        expect(res.status).toBe(200)
        expect(res.body.games).toEqual([])
    })

    // ── Pagination: custom pageSize ───────────────────────────────────────────

    it('respects custom pageSize parameter', async () => {
        mockUser()
        mockGames(makeGames(10))

        const res = await request(app).get('/stats/StatsUser?page=1&pageSize=3')

        expect(res.body.pageSize).toBe(3)
        expect(res.body.games.length).toBe(3)
    })

    // ── Pagination: aggregated stats unaffected by page ───────────────────────

    it('aggregated stats are the same regardless of page requested', async () => {
        const games = makeGames(25)

        mockUser()
        mockGames(games)
        const resPage1 = await request(app).get('/stats/StatsUser?page=1&pageSize=10')

        mockUser()
        mockGames(games)
        const resPage3 = await request(app).get('/stats/StatsUser?page=3&pageSize=10')

        expect(resPage1.body.stats.totalGames).toBe(resPage3.body.stats.totalGames)
        expect(resPage1.body.stats.wins).toBe(resPage3.body.stats.wins)
        expect(resPage1.body.stats.winRate).toBe(resPage3.body.stats.winRate)
    })

    // ── 500: error handling ───────────────────────────────────────────────────

    it('returns 500 when findOne throws', async () => {
        const mockError = new Error('Database connection lost')
        vi.spyOn(mongoose.Model, 'findOne').mockRejectedValueOnce(mockError)
        const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

        const res = await request(app).get('/stats/StatsUser')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Internal server error/i)
        expect(spy).toHaveBeenCalledWith('Error in GET /stats/:username:', mockError)
    })

    it('returns 500 when GameResult.find throws', async () => {
        mockUser()
        vi.spyOn(mongoose.Model, 'find').mockReturnValueOnce({
            sort: vi.fn().mockRejectedValueOnce(new Error('DB unavailable')),
        })
        vi.spyOn(console, 'error').mockImplementation(() => {})

        const res = await request(app).get('/stats/StatsUser')

        expect(res.status).toBe(500)
        expect(res.body.error).toMatch(/Internal server error/i)
    })
})