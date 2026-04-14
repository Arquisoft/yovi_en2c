import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

let isConnected = false

describe('GET /metrics (Prometheus)', () => {

    beforeAll(async () => {
        if (!isConnected) {
            await mongoose.connect(process.env.MONGODB_URI)
            isConnected = true
        }
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    afterAll(async () => {
        if (isConnected) {
            await mongoose.connection.close()
            isConnected = false
        }
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

    it('should contain http_requests_total counter', async () => {
        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/http_requests_total/)
    })

    it('should contain http_request_duration_seconds histogram', async () => {
        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/http_request_duration_seconds/)
    })

    it('should contain nodejs process metrics', async () => {
        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/process_cpu_seconds_total|nodejs_heap_size_total_bytes/)
    })

    // ── Labels presence ───────────────────────────────────────────────────────

    it('should include method label in metrics after a request', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        await request(app).get('/users/someuser')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/method="GET"/)
    })

    it('should include status_code label in metrics after a request', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        await request(app).get('/users/someuser')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/status_code="404"/)
    })

    // ── Normalized paths ─────────────────────────────────────────────────────

    it('should normalize /users/:username path in metrics labels', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        await request(app).get('/users/Pablo')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/path="\/users\/:username"/)
        expect(res.text).not.toMatch(/path="\/users\/Pablo"/)
    })

    it('should normalize /history/:username path in metrics labels', async () => {
        vi.spyOn(mongoose.Model, 'find').mockResolvedValueOnce([])

        await request(app).get('/history/Pablo')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/path="\/history\/:username"/)
        expect(res.text).not.toMatch(/path="\/history\/Pablo"/)
    })

    it('should normalize /stats/:username path in metrics labels', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValueOnce(null)

        await request(app).get('/stats/Pablo')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/path="\/stats\/:username"/)
        expect(res.text).not.toMatch(/path="\/stats\/Pablo"/)
    })

    // ── Metric accumulation ───────────────────────────────────────────────────

    it('should increment counters after requests to other endpoints', async () => {
        vi.spyOn(mongoose.Model, 'findOne').mockResolvedValue(null)

        await request(app).get('/health')

        const res = await request(app).get('/metrics')

        expect(res.text).toMatch(/http_requests_total\{.*\} [1-9]/)
    })

    it('should return 200 consistently on multiple calls', async () => {
        const res1 = await request(app).get('/metrics')
        const res2 = await request(app).get('/metrics')

        expect(res1.status).toBe(200)
        expect(res2.status).toBe(200)
    })

    // ── Health endpoint still works alongside metrics ─────────────────────────

    it('should not interfere with the /health endpoint', async () => {
        // First hit /metrics
        await request(app).get('/metrics')

        // Then verify /health still works normally
        const res = await request(app).get('/health')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('status', 'OK')
    })
})
