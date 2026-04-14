import { describe, it, expect, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../gateway-service.js'
import axios from 'axios'

vi.mock('axios')

describe('Gateway — GET /metrics (Prometheus)', () => {

    afterEach(() => {
        vi.clearAllMocks()
    })

    // ── Endpoint existence ────────────────────────────────────────────────────

    it('should expose a /metrics endpoint', async () => {
        const res = await request(app).get('/metrics')

        expect(res.status).toBe(200)
    })

    it('should return text/plain content type for Prometheus scraping', async () => {
        const res = await request(app).get('/metrics')

        expect(res.headers['content-type']).toMatch(/text\/plain/)
    })

    // ── Prometheus metric format ──────────────────────────────────────────────

    it('should contain http_request_duration_seconds histogram', async () => {
        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/http_request_duration_seconds/)
    })

    // ── Labels presence ───────────────────────────────────────────────────────

    it('should include method label in metrics after a request', async () => {
        // Make a request to generate labeled metrics
        axios.post.mockResolvedValueOnce({ status: 200, data: {} })
        await request(app).post('/login').send({ username: 'test', password: 'test' })

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/method="POST"/)
    })

    it('should include status_code label in metrics after a request', async () => {
        axios.post.mockResolvedValueOnce({ status: 200, data: { success: true } })
        await request(app).post('/login').send({ username: 'test', password: 'test' })

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/status_code="200"/)
    })

    it('should include path label in metrics after a request', async () => {
        axios.post.mockResolvedValueOnce({ status: 200, data: {} })
        await request(app).post('/login').send({ username: 'test', password: 'test' })

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/path="\/login"/)
    })

    // ── /metrics is not counted with a path that inflates metrics ────────────

    it('should return 200 consistently on multiple calls', async () => {
        const res1 = await request(app).get('/metrics')
        const res2 = await request(app).get('/metrics')

        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)
    })

    // ── Normalized paths ─────────────────────────────────────────────────────

    it('should normalize /stats/:username path in metrics labels', async () => {
        axios.get.mockResolvedValueOnce({
            status: 200,
            data: { success: true, username: 'Pablo', stats: {} }
        })

        await request(app)
            .get('/stats/Pablo')
            .set('Authorization', 'Bearer token')

        const res = await request(app).get('/metrics')

        // Normalized path should appear, not /stats/Pablo with the actual username
        expect(res.text).toMatch(/path="\/stats\/:username"/)
        expect(res.text).not.toMatch(/path="\/stats\/Pablo"/)
    })
})
