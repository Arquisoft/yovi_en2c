import { describe, it, expect } from 'vitest'
import request from 'supertest'
import app from '../auth-service.js'

describe('Auth Service', () => {

  it('health endpoint should return OK', async () => {

    const res = await request(app).get('/health')

    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBe('OK')

  })

})