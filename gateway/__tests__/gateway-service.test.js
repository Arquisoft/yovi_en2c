import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../gateway-service.js'
import axios from 'axios'

vi.mock('axios')

describe('Gateway Service', () => {

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GameY endpoints', () =>{

    // =====================
    // NEW GAME
    // =====================
    it('POST /game/new returns YEN when Rust server responds correctly', async () => {

        axios.post.mockResolvedValueOnce({
            status: 200,
            data: { size: 5, turn: 0, layout: "....." }
        })

        const res = await request(app)
        .post('/game/new')
        .send({ size: 5 })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body).toHaveProperty('yen')
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('POST /game/new returns 502 if Rust server fails', async () => {

        axios.post.mockRejectedValueOnce(new Error("Server down"))

        const res = await request(app)
        .post('/game/new')
        .send({ size: 5 })

        expect(res.status).toBe(502)
        expect(res.body.ok).toBe(false)
        expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    // =====================
    // PVB MOVE
    // =====================
    it('POST /game/pvb/move returns updated YEN', async () => {

        axios.post.mockResolvedValueOnce({
            status: 200,
            data: { size: 5, turn: 1, layout: "...B." }
        })

        const res = await request(app)
        .post('/game/pvb/move')
        .send({
            yen: { size: 5, turn: 0, layout: "....." },
            bot: "random_bot",
            row: 0,
            col: 0
        })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body).toHaveProperty('yen')
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('POST /game/pvb/move returns 400 if YEN missing', async () => {

        const res = await request(app)
        .post('/game/pvb/move')
        .send({ bot: "random_bot" })

        expect(res.status).toBe(400)
        expect(res.body.ok).toBe(false)
        expect(res.body.error).toMatch(/Missing YEN/i)
    })

    // =====================
    // BOT CHOOSE
    // =====================
    it('POST /game/bot/choose returns coordinates', async () => {

        axios.post.mockResolvedValueOnce({
            status: 200,
            data: {
                coords: { x: 0, y: 1, z: 3 }
            }
        })

        const res = await request(app)
            .post('/game/bot/choose')
            .send({
                yen: { size: 5, turn: 0, layout: "....." },
                bot: "random_bot"
            })

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body).toHaveProperty('coordinates')
        expect(res.body.coordinates).toEqual({ x: 0, y: 1, z: 3 })
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('POST /game/bot/choose returns 400 if YEN missing', async () => {

        const res = await request(app)
        .post('/game/bot/choose')
        .send({ bot: "random_bot" })

        expect(res.status).toBe(400)
        expect(res.body.ok).toBe(false)
    })

    // =====================
    // HEALTH CHECK
    // =====================
    it('GET /game/status returns OK when Rust server responds correctly', async () => {

        axios.get.mockResolvedValueOnce({
            status: 200,
            data: "GameY running"
        })

        const res = await request(app)
            .get('/game/status')

        expect(res.status).toBe(200)
        expect(res.body.ok).toBe(true)
        expect(res.body.message).toBe("GameY running")
        expect(axios.get).toHaveBeenCalledTimes(1)
    })

    it('GET /game/status returns 502 if Rust server fails', async () => {

        axios.get.mockRejectedValueOnce(new Error("Server down"))

        const res = await request(app)
            .get('/game/status')

        expect(res.status).toBe(502)
        expect(res.body.ok).toBe(false)
        expect(res.body.error).toMatch(/Game server unavailable/i)
    })
  })

  describe('Users endpoints', () => {

    it('POST /createuser forwards request correctly', async () => {

        axios.post.mockResolvedValueOnce({
            status: 200,
            data: { message: "Hello Ana! welcome to the course!" }
        })

        const res = await request(app)
        .post('/createuser')
        .send({ username: 'Ana' })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/Hello Ana/i)
        expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('POST /createuser returns 500 if user-service fails', async () => {

        axios.post.mockRejectedValueOnce(new Error("Service down"))

        const res = await request(app)
        .post('/createuser')
        .send({ username: 'Ana' })

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
        expect(res.body.error).toMatch(/User service unavailable/i)
    })
  })
})
