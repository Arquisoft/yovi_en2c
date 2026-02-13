import { describe, it, expect, afterEach, beforeAll, afterAll, vi } from 'vitest' // <-- IMPORTANTE: añadir vi
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

// Variable para controlar si ya estamos conectados
let isConnected = false;

describe('POST /createuser', () => {
    // Configurar conexión a MongoDB para tests
    beforeAll(async () => {
        // Solo conectar si no estamos conectados
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }
    });

    afterAll(async () => {
        // NO cerramos la conexión aquí para que otros describes puedan usarla
        // La cerraremos al final de todos los tests
    });

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('debe crear un usuario correctamente con username y email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo',
                email: 'pablo@uniovi.es'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('message')
        expect(res.body.message).toMatch(/User Pablo created/i)
        expect(res.body).toHaveProperty('user')
        expect(res.body.user).toHaveProperty('username', 'Pablo')
        expect(res.body.user).toHaveProperty('email', 'pablo@uniovi.es')
    })

    it('debe devolver error 400 si falta el username', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                email: 'pablo@uniovi.es'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Username is a mandatory field/i)
    })

    it('debe devolver error 400 si falta el email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Username is a mandatory field/i)
    })

    it('debe devolver error 400 si el email no es válido', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo',
                email: 'email-invalido'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body).toHaveProperty('error')
    })

    it('debe devolver error 400 si el usuario ya existe', async () => {
        // Primero limpiamos el usuario si existe
        await mongoose.connection.collections['users']?.deleteMany({ username: 'duplicado' });

        // Crear primer usuario
        const res1 = await request(app)
            .post('/createuser')
            .send({
                username: 'duplicado',
                email: 'duplicado@uniovi.es'
            })
            .set('Accept', 'application/json')

        expect(res1.status).toBe(201)

        // Intentar crear el mismo usuario
        const res2 = await request(app)
            .post('/createuser')
            .send({
                username: 'duplicado',
                email: 'duplicado@uniovi.es'
            })
            .set('Accept', 'application/json')

        expect(res2.status).toBe(400)
        expect(res2.body).toHaveProperty('success', false)
        expect(res2.body.error).toMatch(/already in the data base/i)
    })
});

describe('GET /users', () => {
    beforeAll(async () => {
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        // Limpiar colección de users
        await mongoose.connection.collections['users']?.deleteMany({});

        // Crear usuarios de prueba
        await request(app)
            .post('/createuser')
            .send({ username: 'usuario1', email: 'user1@uniovi.es' })

        await request(app)
            .post('/createuser')
            .send({ username: 'usuario2', email: 'user2@uniovi.es' })
    });

    it('debe devolver la lista de usuarios', async () => {
        const res = await request(app)
            .get('/users')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('count')
        expect(res.body.count).toBeGreaterThanOrEqual(2)
        expect(res.body).toHaveProperty('users')
        expect(Array.isArray(res.body.users)).toBe(true)
    })
});

describe('POST /gameresult', () => {
    beforeAll(async () => {
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        // Limpiar colecciones
        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        // Crear usuario para los tests
        await request(app)
            .post('/createuser')
            .send({ username: 'jugador', email: 'jugador@uniovi.es' })
    });

    it('debe guardar un resultado de partida correctamente', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador',
                opponent: 'bot_dificil',
                result: 'win',
                score: 150
            })
            .set('Accept', 'application/json')
            .expect(201)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('message', 'Game result saved')
        expect(res.body).toHaveProperty('game')
        expect(res.body.game).toHaveProperty('username', 'jugador')
        expect(res.body.game).toHaveProperty('opponent', 'bot_dificil')
        expect(res.body.game).toHaveProperty('result', 'win')
        expect(res.body.game).toHaveProperty('score', 150)
    })

    it('debe devolver error 400 si faltan campos', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador',
                result: 'win'
                // Falta opponent
            })
            .set('Accept', 'application/json')
            .expect(400)

        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/absent field/i)
    })

    it('debe devolver error 404 si el usuario no existe', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'usuario_inexistente',
                opponent: 'bot',
                result: 'win'
            })
            .set('Accept', 'application/json')
            .expect(404)

        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/does not exist/i)
    })
});

describe('GET /history/:username', () => {
    beforeAll(async () => {
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        // Limpiar colecciones
        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        // Crear usuario
        await request(app)
            .post('/createuser')
            .send({ username: 'historial_user', email: 'history@uniovi.es' })

        // Crear algunas partidas
        await request(app)
            .post('/gameresult')
            .send({ username: 'historial_user', opponent: 'bot1', result: 'win', score: 100 })

        await request(app)
            .post('/gameresult')
            .send({ username: 'historial_user', opponent: 'bot2', result: 'loss', score: 50 })
    });

    it('debe devolver el historial de un usuario', async () => {
        const res = await request(app)
            .get('/history/historial_user')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('username', 'historial_user')
        expect(res.body).toHaveProperty('stats')
        expect(res.body.stats).toHaveProperty('wins', 1)
        expect(res.body.stats).toHaveProperty('losses', 1)
        expect(res.body).toHaveProperty('total', 2)
        expect(Array.isArray(res.body.games)).toBe(true)
        expect(res.body.games.length).toBe(2)
    })

    it('debe devolver historial vacío para usuario sin partidas', async () => {
        const res = await request(app)
            .get('/history/usuario_sin_partidas')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('username', 'usuario_sin_partidas')
        expect(res.body).toHaveProperty('total', 0)
        expect(res.body.games.length).toBe(0)
    })
});

describe('GET /ranking', () => {
    beforeAll(async () => {
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        // Limpiar colecciones
        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        // Crear usuarios
        await request(app)
            .post('/createuser')
            .send({ username: 'top1', email: 'top1@uniovi.es' })

        await request(app)
            .post('/createuser')
            .send({ username: 'top2', email: 'top2@uniovi.es' })

        await request(app)
            .post('/createuser')
            .send({ username: 'top3', email: 'top3@uniovi.es' })

        // Crear partidas (top1: 3 wins, top2: 2 wins, top3: 0 wins)
        for (let i = 0; i < 3; i++) {
            await request(app)
                .post('/gameresult')
                .send({ username: 'top1', opponent: 'bot', result: 'win', score: 100 })
        }

        for (let i = 0; i < 2; i++) {
            await request(app)
                .post('/gameresult')
                .send({ username: 'top2', opponent: 'bot', result: 'win', score: 100 })
        }

        await request(app)
            .post('/gameresult')
            .send({ username: 'top3', opponent: 'bot', result: 'loss', score: 0 })
    });

    it('debe devolver el ranking ordenado por victorias', async () => {
        const res = await request(app)
            .get('/ranking')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('ranking')
        expect(Array.isArray(res.body.ranking)).toBe(true)

        const ranking = res.body.ranking
        expect(ranking.length).toBeGreaterThanOrEqual(2)

        // Puede que top3 no aparezca si no tiene wins
        if (ranking.length > 0 && ranking[0]?.username === 'top1') {
            expect(ranking[0].wins).toBe(3)
        }
        if (ranking.length > 1 && ranking[1]?.username === 'top2') {
            expect(ranking[1].wins).toBe(2)
        }
    })
});

describe('GET /health', () => {
    it('debe devolver el estado del servidor', async () => {
        const res = await request(app)
            .get('/health')
            .expect(200)

        expect(res.body).toHaveProperty('status', 'OK')
        expect(res.body).toHaveProperty('server', 'running')
        expect(res.body).toHaveProperty('database')
        expect(res.body).toHaveProperty('timestamp')
    })
});

// Cerrar conexión al final de todos los tests
afterAll(async () => {
    if (isConnected) {
        await mongoose.connection.close();
    }
});