const request = require('supertest');
const app = require('../auth-service');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'test_secret';

// ---------------------- MOCK FETCH ----------------------
global.fetch = async (url, options) => {
    const body = JSON.parse(options.body || '{}');

    // ---------------- REGISTER ----------------
    if (url.includes('/createuser')) {

        // SUCCESS PATH
        if (body.username === 'ok_user') {
            return {
                status: 201,
                json: async () => ({ success: true }),
            };
        }

        // FAILURE PATH (users-service error)
        if (body.username === 'existing') {
            return {
                status: 400,
                json: async () => ({
                    success: false,
                    error: 'User already exists',
                }),
            };
        }

        // CRASH PATH (covers catch block)
        if (body.username === 'crash_user') {
            throw new Error('Network failure');
        }

        return {
            status: 400,
            json: async () => ({
                success: false,
                error: 'default fail',
            }),
        };
    }

    // ---------------- LOGIN ----------------
    if (url.includes('/login')) {

        // SUCCESS
        if (body.username === 'valid_user') {
            return {
                status: 200,
                json: async () => ({
                    success: true,
                    user: {
                        id: '1',
                        username: 'valid_user',
                    },
                }),
            };
        }

        // FAILURE (invalid credentials)
        if (body.username === 'wrong') {
            return {
                status: 401,
                json: async () => ({
                    success: false,
                    error: 'Invalid credentials',
                }),
            };
        }

        return {
            status: 401,
            json: async () => ({
                success: false,
                error: 'Invalid credentials',
            }),
        };
    }

    throw new Error('Network failure');
};

// ---------------------- TESTS ----------------------
describe('Auth Service', () => {

    // HEALTH CHECK
    it('should return health status', async () => {
        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('OK');
        expect(res.body.service).toBe('auth-service');
    });

    // REGISTER SUCCESS
    it('should register a user successfully', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'ok_user',
                password: '1234',
                email: 'john@test.com',
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    // REGISTER FAIL (missing fields)
    it('should fail registration if missing username', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                password: '1234',
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    // REGISTER FAILURE (users-service rejection)
    it('should handle users-service rejection', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'existing',
                password: '1234',
            });

        expect(res.status).toBe(400);
        expect(res.body.success).toBe(false);
    });

    // LOGIN SUCCESS
    it('should login and return JWT token', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'valid_user',
                password: '1234',
            });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.token).toBeDefined();

        const decoded = jwt.verify(res.body.token, JWT_SECRET);
        expect(decoded.username).toBe('valid_user');
    });

    // LOGIN FAIL
    it('should fail login with wrong credentials', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'wrong',
                password: '1234',
            });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    // VERIFY TOKEN SUCCESS
    it('should verify valid JWT token', async () => {
        const token = jwt.sign(
            { id: '1', username: 'john' },
            JWT_SECRET,
            { expiresIn: '1h' }
        );

        const res = await request(app)
            .get('/verify')
            .set('Authorization', `Bearer ${token}`);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.user.username).toBe('john');
    });

    // VERIFY FAIL
    it('should reject invalid token', async () => {
        const res = await request(app)
            .get('/verify')
            .set('Authorization', 'Bearer invalidtoken');

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    // REGISTER SUCCESS PATH (explicit coverage)
    it('register success path', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'ok_user',
                password: '1234',
                email: 'a@a.com',
            });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
    });

    // LOGIN SUCCESS PATH (explicit coverage)
    it('login success returns token', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'valid_user',
                password: '1234',
            });

        expect(res.status).toBe(200);
        expect(res.body.token).toBeDefined();
    });

    // LOGIN FAILURE PATH (explicit coverage)
    it('login fails with invalid credentials', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'wrong',
                password: '1234',
            });

        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
    });

    // CATCH BLOCK COVERAGE
    it('register handles service crash (catch block)', async () => {
        const res = await request(app)
            .post('/register')
            .send({
                username: 'crash_user',
                password: '1234',
            });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
    });

});