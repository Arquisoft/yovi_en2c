import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../gateway-service.js'
import axios from 'axios'

vi.mock('axios')

describe('Gateway Service', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('GameY endpoints', () => {
    it('POST /game/new returns YEN when Rust server responds correctly', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { size: 5, turn: 0, layout: '.....' }
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
      axios.post.mockRejectedValueOnce(new Error('Server down'))

      const res = await request(app)
        .post('/game/new')
        .send({ size: 5 })

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    it('POST /game/new propagates axios response error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 503,
          data: { error: 'Downstream error' }
        }
      })

      const res = await request(app)
        .post('/game/new')
        .send({ size: 5 })

      expect(res.status).toBe(503)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Downstream error/i)
    })

    it('POST /game/pvb/move returns updated YEN', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: { size: 5, turn: 1, layout: '...B.' }
      })

      const res = await request(app)
        .post('/game/pvb/move')
        .send({
          yen: { size: 5, turn: 0, layout: '.....' },
          bot: 'random_bot',
          row: 0,
          col: 0
        })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body).toHaveProperty('yen')
      expect(axios.post).toHaveBeenCalledTimes(1)
    })

    it('POST /game/pvb/move returns finished data when backend sends it', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          yen: { size: 5, turn: 2, layout: '...B.' },
          finished: true,
          winner: 'B',
          winning_edges: [[0, 0], [0, 1]]
        }
      })

      const res = await request(app)
        .post('/game/pvb/move')
        .send({
          yen: { size: 5, turn: 1, layout: '.....' },
          bot: 'smart_bot',
          row: 0,
          col: 0
        })

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.finished).toBe(true)
      expect(res.body.winner).toBe('B')
      expect(res.body.winning_edges).toEqual([[0, 0], [0, 1]])
    })

    it('POST /game/pvb/move returns 400 if YEN missing', async () => {
      const res = await request(app)
        .post('/game/pvb/move')
        .send({ bot: 'random_bot' })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing YEN/i)
    })

    it('POST /game/pvb/move returns 400 if row/col missing', async () => {
      const res = await request(app)
        .post('/game/pvb/move')
        .send({
          yen: { size: 5 },
          bot: 'random_bot'
        })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing row\/col/i)
    })

    it('POST /game/pvb/move returns 400 if invalid bot id', async () => {
      const res = await request(app)
        .post('/game/pvb/move')
        .send({
          yen: { size: 5 },
          bot: 'invalid_bot',
          row: 0,
          col: 0
        })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Invalid bot id/i)
    })

    it('POST /game/pvb/move propagates axios response error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 422,
          data: { error: 'Illegal move' }
        }
      })

      const res = await request(app)
        .post('/game/pvb/move')
        .send({
          yen: { size: 5, turn: 0, layout: '.....' },
          bot: 'random_bot',
          row: 0,
          col: 0
        })

      expect(res.status).toBe(422)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Illegal move/i)
    })

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
          yen: { size: 5, turn: 0, layout: '.....' },
          bot: 'random_bot'
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
        .send({ bot: 'random_bot' })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Missing YEN/i)
    })

    it('POST /game/bot/choose returns 400 if invalid bot id', async () => {
      const res = await request(app)
        .post('/game/bot/choose')
        .send({
          yen: { size: 5 },
          bot: 'invalid_bot'
        })

      expect(res.status).toBe(400)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Invalid bot id/i)
    })

    it('POST /game/bot/choose propagates axios response error status', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 429,
          data: { message: 'Rate limited' }
        }
      })

      const res = await request(app)
        .post('/game/bot/choose')
        .send({
          yen: { size: 5, turn: 0, layout: '.....' },
          bot: 'smart_bot'
        })

      expect(res.status).toBe(429)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Rate limited/i)
    })

    it('GET /game/status returns OK when Rust server responds correctly', async () => {
      axios.get.mockResolvedValueOnce({
        status: 200,
        data: 'GameY running'
      })

      const res = await request(app)
        .get('/game/status')

      expect(res.status).toBe(200)
      expect(res.body.ok).toBe(true)
      expect(res.body.message).toBe('GameY running')
      expect(axios.get).toHaveBeenCalledTimes(1)
    })

    it('GET /game/status returns 502 if Rust server fails', async () => {
      axios.get.mockRejectedValueOnce(new Error('Server down'))

      const res = await request(app)
        .get('/game/status')

      expect(res.status).toBe(502)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Game server unavailable/i)
    })

    it('GET /game/status propagates axios response error status', async () => {
      axios.get.mockRejectedValueOnce({
        response: {
          status: 504,
          data: { message: 'Timeout' }
        }
      })

      const res = await request(app)
        .get('/game/status')

      expect(res.status).toBe(504)
      expect(res.body.ok).toBe(false)
      expect(res.body.error).toMatch(/Timeout/i)
    })
  })

  describe('Users endpoints', () => {
    it('POST /createuser forwards request correctly', async () => {
      axios.post.mockResolvedValueOnce({
        status: 201,
        data: { success: true, message: 'User Ana created' }
      })

      const payload = {
        username: 'Ana',
        email: 'ana@uniovi.es',
        password: '123456'
      }

      const res = await request(app)
        .post('/createuser')
        .send(payload)

      expect(res.status).toBe(201)
      expect(res.body).toHaveProperty('message')
      expect(res.body.message).toMatch(/User Ana created/i)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/createuser$/),
        payload
      )
    })

    it('POST /createuser returns 500 if user-service fails', async () => {
      axios.post.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app)
        .post('/createuser')
        .send({ username: 'Ana', email: 'ana@uniovi.es', password: '123456' })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/User service unavailable/i)
    })

    it('POST /createuser propagates user-service error response', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 409,
          data: { error: 'User already exists' }
        }
      })

      const res = await request(app)
        .post('/createuser')
        .send({ username: 'Ana', email: 'ana@uniovi.es', password: '123456' })

      expect(res.status).toBe(409)
      expect(res.body.error).toMatch(/User already exists/i)
    })

    it('POST /login forwards request correctly', async () => {
      axios.post.mockResolvedValueOnce({
        status: 200,
        data: {
          success: true,
          message: 'Welcome Ana',
          user: { username: 'Ana', email: 'ana@uniovi.es' }
        }
      })

      const payload = {
        username: 'Ana',
        password: '123456'
      }

      const res = await request(app)
        .post('/login')
        .send(payload)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.message).toMatch(/Welcome Ana/i)
      expect(axios.post).toHaveBeenCalledTimes(1)
      expect(axios.post).toHaveBeenCalledWith(
        expect.stringMatching(/\/login$/),
        payload
      )
    })

    it('POST /login propagates user-service error response', async () => {
      axios.post.mockRejectedValueOnce({
        response: {
          status: 401,
          data: { error: 'Invalid credentials' }
        }
      })

      const res = await request(app)
        .post('/login')
        .send({ username: 'Ana', password: 'wrong' })

      expect(res.status).toBe(401)
      expect(res.body.error).toMatch(/Invalid credentials/i)
    })

    it('POST /login returns 500 if user-service fails', async () => {
      axios.post.mockRejectedValueOnce(new Error('Service down'))

      const res = await request(app)
        .post('/login')
        .send({ username: 'Ana', password: '123456' })

      expect(res.status).toBe(500)
      expect(res.body).toHaveProperty('error')
      expect(res.body.error).toMatch(/User service unavailable/i)
    })
  })
})