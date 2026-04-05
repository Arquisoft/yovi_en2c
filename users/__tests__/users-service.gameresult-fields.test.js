import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

describe('POST /gameresult — nuevos campos (winner, boardSize, gameMode)', () => {
    beforeAll(async () => {
        const TEST_URI = process.env.MONGODB_URI;
        if (mongoose.connection.readyState === 0) {
            await mongoose.connect(TEST_URI);
        }

        await mongoose.connection.collections['users']?.deleteMany({ username: 'jugador_new_fields' });
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({ username: 'jugador_new_fields', email: 'newfields@uniovi.es', password: '123456' });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    // ─── winner ──────────────────────────────────────────────────────────────

    it('should save winner field when provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'minimax_bot',
                result: 'win',
                winner: 'jugador_new_fields',
                score: 5,
                boardSize: 7,
                gameMode: 'pvb'
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('winner', 'jugador_new_fields')
    })

    it('should save winner as bot name when bot wins', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'minimax_bot',
                result: 'loss',
                winner: 'minimax_bot',
                score: 3,
                boardSize: 9,
                gameMode: 'pvb'
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('winner', 'minimax_bot')
        expect(res.body.game).toHaveProperty('result', 'loss')
    })

    it('should save winner as null when not provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 4
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game.winner).toBeNull()
    })

    // ─── boardSize ───────────────────────────────────────────────────────────

    it('should save boardSize when provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'heuristic_bot',
                result: 'win',
                score: 6,
                boardSize: 11
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('boardSize', 11)
    })

    it('should save default boardSize 7 when not provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 2
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('boardSize', 7)
    })

    it('should save boardSize 5 (minimum recommended)', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 1,
                boardSize: 5
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('boardSize', 5)
    })

    it('should save large boardSize (> 11) as user can choose custom sizes', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 10,
                boardSize: 15
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('boardSize', 15)
    })

    // ─── gameMode ────────────────────────────────────────────────────────────

    it('should save gameMode pvb when provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'alfa_beta_bot',
                result: 'win',
                score: 7,
                gameMode: 'pvb'
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('gameMode', 'pvb')
    })

    it('should save gameMode pvp when provided (future multiplayer)', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'otro_usuario',
                result: 'win',
                score: 8,
                gameMode: 'pvp'
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('gameMode', 'pvp')
    })

    it('should save default gameMode pvb when not provided', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 3
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('gameMode', 'pvb')
    })

    it('should return 500 when gameMode has an invalid value', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 3,
                gameMode: 'invalid_mode'
            })
            .set('Accept', 'application/json')
            .expect(500)

        expect(res.body.success).toBe(false)
    })

    // ─── Combinación de todos los campos nuevos ───────────────────────────────

    it('should save all new fields together correctly', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'monte_carlo_hard',
                result: 'win',
                winner: 'jugador_new_fields',
                score: 12,
                boardSize: 9,
                gameMode: 'pvb'
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('winner', 'jugador_new_fields')
        expect(res.body.game).toHaveProperty('boardSize', 9)
        expect(res.body.game).toHaveProperty('gameMode', 'pvb')
        expect(res.body.game).toHaveProperty('score', 12)
        expect(res.body.game).toHaveProperty('result', 'win')
    })

    // ─── date ────────────────────────────────────────────────────────────────

    it('should save date automatically', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador_new_fields',
                opponent: 'random_bot',
                result: 'win',
                score: 1
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body.success).toBe(true)
        expect(res.body.game).toHaveProperty('date')
        expect(new Date(res.body.game.date).toString()).not.toBe('Invalid Date')
    })
});
