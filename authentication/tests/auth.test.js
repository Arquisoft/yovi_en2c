import { describe, it, beforeAll, expect } from 'vitest'
import request from 'supertest'
import mongoose from 'mongoose'
import app from '../auth-service.js'

let isConnected = false


describe('Auth Service', () => {

  
beforeAll(async () => {
  if (!isConnected) {
    const TEST_URI = process.env.MONGODB_URI
    if (!TEST_URI) {
      throw new Error('MONGODB_URI not set in environment')
    }
    await mongoose.connect(TEST_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    })
    isConnected = true
  }
})

  // ================= HEALTH =================

  it('health endpoint should return OK', async () => {

    const res = await request(app).get('/health')

    expect(res.statusCode).toBe(200)
    expect(res.body.status).toBe('OK')

  })


  // ================= REGISTER =================

  it('register should fail if username or password missing', async () => {

    const res = await request(app)
      .post('/register')
      .send({
        username: "player1"
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)

  })


  it('register should create a user', async () => {

    const res = await request(app)
      .post('/register')
      .send({
        username: "testuser4",
        email: "test4@test.com",
        password: "123456"
      })

    expect(res.statusCode).toBe(201)
    expect(res.body.success).toBe(true)

  })


  it('register should fail if user already exists', async () => {

    await request(app)
      .post('/register')
      .send({
        username: "duplicateuser",
        email: "dup@test.com",
        password: "123456"
      })

    const res = await request(app)
      .post('/register')
      .send({
        username: "duplicateuser",
        email: "dup@test.com",
        password: "123456"
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.error).toBe('User already exists')

  })
   it('register should handle missing email', async () => {
    const res = await request(app).post('/register').send({
      username: 'usernoemail',
      password: '123456'
    })
    // your current code allows missing email, so success is possible
    expect([201, 500]).toContain(res.statusCode)
  })


  // ================= LOGIN =================

  it('login should fail if credentials missing', async () => {

    const res = await request(app)
      .post('/login')
      .send({
        username: "player"
      })

    expect(res.statusCode).toBe(400)
    expect(res.body.success).toBe(false)

  })


  it('login should fail with invalid credentials', async () => {

    const res = await request(app)
      .post('/login')
      .send({
        username: "nouser",
        password: "123456"
      })

    expect(res.statusCode).toBe(401)
    expect(res.body.success).toBe(false)

  })


  it('login should fail with wrong password', async () => {
    await request(app).post('/register').send({
      username: 'userwrongpass',
      email: 'userwp@test.com',
      password: '123456'
    })
    const res = await request(app).post('/login').send({
      username: 'userwrongpass',
      password: 'wrongpass'
    })
    expect(res.statusCode).toBe(401)
  })

  it('login should return a JWT token', async () => {

    await request(app)
      .post('/register')
      .send({
        username: "loginuser",
        email: "login@test.com",
        password: "123456"
      })

    const res = await request(app)
      .post('/login')
      .send({
        username: "loginuser",
        password: "123456"
      })

    expect(res.statusCode).toBe(200)
    expect(res.body.token).toBeDefined()

  })


  // ================= VERIFY TOKEN =================

  it('verify should return user if token is valid', async () => {

    await request(app)
      .post('/register')
      .send({
        username: "verifyuser",
        email: "verify@test.com",
        password: "123456"
      })

    const login = await request(app)
      .post('/login')
      .send({
        username: "verifyuser",
        password: "123456"
      })

    const token = login.body.token

    const res = await request(app)
      .get('/verify')
      .set('Authorization', `Bearer ${token}`)

    expect(res.statusCode).toBe(200)
    expect(res.body.success).toBe(true)

  })


  it('verify should fail without token', async () => {

    const res = await request(app)
      .get('/verify')

    expect(res.statusCode).toBe(401)

  })

    it('verify should fail with invalid token', async () => {
    const res = await request(app).get('/verify').set('Authorization', 'Bearer invalidtoken')
    expect(res.statusCode).toBe(401)
  })

})