import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest'
import request from 'supertest'
import app from '../users-service.js'
import mongoose from 'mongoose'

let isConnected = false;

describe('POST /createuser', () => {

    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }
    });

    beforeEach(async () => {
        await mongoose.connection.collections['users']?.deleteMany({});
    });

    afterAll(async () => {

    });

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should create an user with username and email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo',
                email: 'pablo@uniovi.es',
                password: '123456'
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

    it('should create an user without an email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UsuarioWithoutEmail',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.message).toMatch(/User UsuarioWithoutEmail created/i)
        expect(res.body.user).toHaveProperty('username', 'UsuarioWithoutEmail')
        expect(res.body.user).toHaveProperty('email', null)
    })

    it('should create a new user with empty email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UsuarEmailEmpty',
                email: '',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.user).toHaveProperty('username', 'UsuarEmailEmpty')
        expect(res.body.user).toHaveProperty('email', null)
    })

    it('should create a new user with an email with spaces', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UserEmailSpaces',
                email: '   ',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.user).toHaveProperty('username', 'UserEmailSpaces')
        expect(res.body.user).toHaveProperty('email', null)
    })

    it('should gave error 400 if there is not username', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                email: 'pablo@uniovi.es',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Username is a mandatory field/i)
    })

    it('should gave error 400 if password is missing', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo',
                email: 'pablo@uniovi.es'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/Password is a mandatory field/i)
    })

    it('should gave error 400 if the email is not valid', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'Pablo',
                email: 'email-invalido',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('success', false)
        expect(res.body).toHaveProperty('error')
    })

    it('should gave error 400 if the user already exists', async () => {
        await mongoose.connection.collections['users']?.deleteMany({ username: 'duplicado' });

        const res1 = await request(app)
            .post('/createuser')
            .send({
                username: 'duplicado',
                email: 'duplicado@uniovi.es',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res1.status).toBe(201)

        const res2 = await request(app)
            .post('/createuser')
            .send({
                username: 'duplicado',
                email: 'duplicado@uniovi.es',
                password: '123456'
            })
            .set('Accept', 'application/json')

        expect(res2.status).toBe(400)
        expect(res2.body).toHaveProperty('success', false)
        expect(res2.body.error).toMatch(/already in the data base/i)
    })

    describe('POST /createuser - Generic error handling', () => {
        beforeAll(async () => {
            if (!isConnected) {
                const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
                await mongoose.connect(TEST_URI);
                isConnected = true;
            }
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a generic database error occurs', async () => {
            const mockError = new Error('Unexpected MongoDB connection error');
            mockError.code = 12345;
            mockError.name = 'MongoNetworkError';

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(mockError)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'test_generic_error',
                    email: 'test@uniovi.es',
                    password: '123456'
                })
                .set('Accept', 'application/json')

            expect(res.status).toBe(500)
            expect(res.body).toHaveProperty('success', false)

            expect(res.body.error).toBe('Internal sevrer error')

            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error en POST /createuser:',
                mockError
            )

            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 for errors that are neither ValidationError nor code 11000', async () => {
            const errorsToTest = [
                new TypeError('Cannot read property of undefined'),
                new Error('Database connection lost'),
                { message: 'Strange error', name: 'CustomError', code: 99999 }
            ]

            for (const error of errorsToTest) {
                const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                    .mockRejectedValueOnce(error)

                const res = await request(app)
                    .post('/createuser')
                    .send({
                        username: 'test_error',
                        email: 'test@uniovi.es',
                        password: '123456'
                    })
                    .set('Accept', 'application/json')

                expect(res.status).toBe(500)
                expect(res.body.error).toBe('Internal sevrer error')

                saveSpy.mockRestore()
            }
        })

        it('should NOT trigger the generic catch for validation errors', async () => {
            const validationError = new Error('Validation error');
            validationError.name = 'ValidationError';
            validationError.errors = {
                email: { message: 'Email is invalid' }
            };

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(validationError)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'test_validation',
                    email: 'invalid-email',
                    password: '123456'
                })
                .set('Accept', 'application/json')

            expect(res.status).toBe(400)
            expect(res.body.error).not.toBe('Internal sevrer error')

            expect(consoleErrorSpy).not.toHaveBeenCalled()

            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should NOT trigger the generic catch for duplicate key errors (code 11000)', async () => {
            const duplicateError = new Error('Duplicate key error');
            duplicateError.code = 11000;
            duplicateError.keyPattern = { username: 1 };

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(duplicateError)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'duplicate_user',
                    email: 'duplicate@uniovi.es',
                    password: '123456'
                })
                .set('Accept', 'application/json')

            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/already in the data base/i)
            expect(res.body.error).not.toBe('Internal sevrer error')

            expect(consoleErrorSpy).not.toHaveBeenCalled()

            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should handle errors with no code or name property', async () => {
            const malformedError = { someProperty: 'this is not a standard error' };

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(malformedError)

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'test_malformed',
                    email: 'test@uniovi.es',
                    password: '123456'
                })
                .set('Accept', 'application/json')

            expect(res.status).toBe(500)
            expect(res.body.error).toBe('Internal sevrer error')

            saveSpy.mockRestore()
        })
    })
});

describe('GET /users', () => {
    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        await mongoose.connection.collections['users']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({ username: 'usuario1', email: 'user1@uniovi.es', password: '123456' })

        await request(app)
            .post('/createuser')
            .send({ username: 'usuario2', email: 'user2@uniovi.es', password: '123456' })
    });

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('should return the list of users', async () => {
        const res = await request(app)
            .get('/users')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('count')
        expect(res.body.count).toBeGreaterThanOrEqual(2)
        expect(res.body).toHaveProperty('users')
        expect(Array.isArray(res.body.users)).toBe(true)
    })

    describe('GET /users - Error handling', () => {
        it('should return 500 when a database error occurs during find()', async () => {
            const mockError = new Error('Database connection failed');
            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw mockError;
                });

            const res = await request(app)
                .get('/users')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed')

            findSpy.mockRestore()
        })

        it('should return 500 when a database error occurs during sort()', async () => {
            const mockError = new Error('Sort operation failed');

            const mockQuery = {
                sort: vi.fn().mockRejectedValueOnce(mockError)
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(mockQuery)

            const res = await request(app)
                .get('/users')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Sort operation failed')

            findSpy.mockRestore()
        })

        it('should return 500 with different error messages', async () => {
            const errorMessages = [
                'MongoDB server not available',
                'Network error',
                'Authentication failed',
                'Collection does not exist'
            ]

            for (const errorMessage of errorMessages) {
                const mockError = new Error(errorMessage);

                const mockQuery = {
                    sort: vi.fn().mockRejectedValueOnce(mockError)
                };

                const findSpy = vi.spyOn(mongoose.Model, 'find')
                    .mockReturnValueOnce(mockQuery)

                const res = await request(app)
                    .get('/users')
                    .expect(500)

                expect(res.body.error).toBe(errorMessage)

                findSpy.mockRestore()
            }
        })

        it('should handle non-Error objects thrown', async () => {
            const nonErrorObject = {
                message: 'Something went wrong',
                code: 'ERROR',
                details: 'Custom error object'
            };

            const mockQuery = {
                sort: vi.fn().mockRejectedValueOnce(nonErrorObject)
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(mockQuery)

            const res = await request(app)
                .get('/users')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body).toHaveProperty('error')
            expect(typeof res.body.error).toBe('string')

            findSpy.mockRestore()
        })

        it('should handle error when find() returns null and sort is called', async () => {
            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(null)

            const res = await request(app)
                .get('/users')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBeDefined()

            findSpy.mockRestore()
        })
    })
})

describe('POST /gameresult', () => {
    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({ username: 'jugador', email: 'jugador@uniovi.es', password: '123456' })
    });

    it('should save correctly the game result in the db', async () => {
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

    it('should return error 400 if fields are missing', async () => {
        const res = await request(app)
            .post('/gameresult')
            .send({
                username: 'jugador',
                result: 'win'
            })
            .set('Accept', 'application/json')
            .expect(400)

        expect(res.body).toHaveProperty('success', false)
        expect(res.body.error).toMatch(/absent field/i)
    })

    it('should return 404 error if user does not exist', async () => {
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

    describe('POST /gameresult - Error handling', () => {
        beforeAll(async () => {
            if (!isConnected) {
                const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
                await mongoose.connect(TEST_URI);
                isConnected = true;
            }

            await mongoose.connection.collections['users']?.deleteMany({ username: 'jugador_error' });
            await request(app)
                .post('/createuser')
                .send({ username: 'jugador_error', email: 'error@uniovi.es', password: '123456' })
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a database error occurs during user lookup', async () => {
            const mockError = new Error('Database connection failed during user lookup');
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockRejectedValueOnce(mockError)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/gameresult')
                .send({
                    username: 'jugador_error',
                    opponent: 'bot',
                    result: 'win',
                    score: 100
                })
                .set('Accept', 'application/json')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed during user lookup')

            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in POST /gameresult:',
                mockError
            )

            findOneSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 when a database error occurs during game save', async () => {
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockResolvedValueOnce({ username: 'jugador_error' })

            const mockError = new Error('Database error while saving game result');
            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(mockError)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/gameresult')
                .send({
                    username: 'jugador_error',
                    opponent: 'bot',
                    result: 'win',
                    score: 100
                })
                .set('Accept', 'application/json')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database error while saving game result')

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in POST /gameresult:',
                mockError
            )

            findOneSpy.mockRestore()
            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 with different error messages', async () => {
            const errorMessages = [
                'MongoDB connection lost',
                'Write operation failed',
                'Duplicate key error',
                'Validation failed',
                'Network timeout'
            ]

            for (const errorMessage of errorMessages) {
                const mockError = new Error(errorMessage);

                const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                    .mockRejectedValueOnce(mockError)

                const res = await request(app)
                    .post('/gameresult')
                    .send({
                        username: 'jugador_error',
                        opponent: 'bot',
                        result: 'win',
                        score: 100
                    })
                    .set('Accept', 'application/json')
                    .expect(500)

                expect(res.body.error).toBe(errorMessage)

                findOneSpy.mockRestore()
            }
        })

        it('should handle non-Error objects thrown during database operation', async () => {
            const nonErrorObject = {
                message: 'Custom database error',
                code: 12345,
                details: 'Some detailed information'
            };

            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockRejectedValueOnce(nonErrorObject)

            const res = await request(app)
                .post('/gameresult')
                .send({
                    username: 'jugador_error',
                    opponent: 'bot',
                    result: 'win',
                    score: 100
                })
                .set('Accept', 'application/json')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body).toHaveProperty('error')
            expect(typeof res.body.error).toBe('string')

            findOneSpy.mockRestore()
        })

        it('should handle error when GameResult model save fails after user exists', async () => {
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockResolvedValueOnce({ username: 'jugador_error' })

            const mockError = new Error('GameResult validation failed');
            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .post('/gameresult')
                .send({
                    username: 'jugador_error',
                    opponent: 'bot',
                    result: 'win',
                    score: 100
                })
                .set('Accept', 'application/json')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('GameResult validation failed')

            findOneSpy.mockRestore()
            saveSpy.mockRestore()
        })

        it('should handle error when username contains special characters', async () => {
            const mockError = new Error('Username contains invalid characters');
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .post('/gameresult')
                .send({
                    username: 'usuario@especial#123',
                    opponent: 'bot',
                    result: 'win',
                    score: 100
                })
                .set('Accept', 'application/json')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Username contains invalid characters')

            findOneSpy.mockRestore()
        })
    })
});

describe('GET /history/:username', () => {
    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({ username: 'historial_user', email: 'history@uniovi.es', password: '123456' })

        await request(app)
            .post('/gameresult')
            .send({ username: 'historial_user', opponent: 'bot1', result: 'win', score: 100 })

        await request(app)
            .post('/gameresult')
            .send({ username: 'historial_user', opponent: 'bot2', result: 'loss', score: 50 })
    });

    it('should return a user history', async () => {
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

    it('should return empty history for user without games', async () => {
        const res = await request(app)
            .get('/history/usuario_sin_partidas')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('username', 'usuario_sin_partidas')
        expect(res.body).toHaveProperty('total', 0)
        expect(res.body.games.length).toBe(0)
    })

    describe('GET /history/:username - Error handling', () => {
        beforeAll(async () => {
            if (!isConnected) {
                const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
                await mongoose.connect(TEST_URI);
                isConnected = true;
            }

            await mongoose.connection.collections['users']?.deleteMany({});
            await mongoose.connection.collections['gameresults']?.deleteMany({});

            await request(app)
                .post('/createuser')
                .send({ username: 'history_user', email: 'history@uniovi.es', password: '123456' })
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a database error occurs during GameResult.find()', async () => {
            const mockError = new Error('Database connection failed while fetching history');

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw mockError;
                })

            const res = await request(app)
                .get('/history/history_user')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed while fetching history')

            findSpy.mockRestore()
        })

        it('should return 500 when a database error occurs during sort()', async () => {
            const mockError = new Error('Sort operation failed in history query');

            const mockQuery = {
                sort: vi.fn().mockReturnThis(),
                limit: vi.fn().mockRejectedValueOnce(mockError)
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(mockQuery)

            const res = await request(app)
                .get('/history/history_user')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Sort operation failed in history query')

            findSpy.mockRestore()
        })

        it('should return 500 when a database error occurs during limit()', async () => {
            const mockError = new Error('Limit operation failed in history query');

            const mockQuery = {
                sort: vi.fn().mockReturnThis(),
                limit: vi.fn().mockRejectedValueOnce(mockError)
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(mockQuery)

            const res = await request(app)
                .get('/history/history_user')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Limit operation failed in history query')

            findSpy.mockRestore()
        })

        it('should return 500 when there is an error parsing the limit parameter', async () => {
            const mockError = new Error('Invalid limit parameter');

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw mockError;
                })

            const res = await request(app)
                .get('/history/history_user?limit=invalid')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Invalid limit parameter')

            findSpy.mockRestore()
        })

        it('should return 500 with different error messages', async () => {
            const errorMessages = [
                'MongoDB server not available',
                'Network error while fetching history',
                'Authentication failed',
                'Collection "gameresults" does not exist',
                'Database timeout'
            ]

            for (const errorMessage of errorMessages) {
                const mockError = new Error(errorMessage);

                const findSpy = vi.spyOn(mongoose.Model, 'find')
                    .mockImplementationOnce(() => {
                        throw mockError;
                    })

                const res = await request(app)
                    .get('/history/history_user')
                    .expect(500)

                expect(res.body.error).toBe(errorMessage)

                findSpy.mockRestore()
            }
        })

        it('should handle non-Error objects thrown during database operation', async () => {
            const nonErrorObject = {
                message: 'Custom database error in history',
                code: 'HISTORY_ERROR',
                severity: 'high'
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw nonErrorObject;
                })

            const res = await request(app)
                .get('/history/history_user')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body).toHaveProperty('error')
            expect(typeof res.body.error).toBe('string')

            findSpy.mockRestore()
        })

        it('should handle error when username parameter contains special characters', async () => {
            const mockError = new Error('Invalid username format in database query');

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw mockError;
                })

            const res = await request(app)
                .get('/history/user@with#special$chars')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Invalid username format in database query')

            findSpy.mockRestore()
        })

        it('should handle error when username is extremely long', async () => {
            const longUsername = 'a'.repeat(1000);
            const mockError = new Error('Username exceeds maximum length');

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockImplementationOnce(() => {
                    throw mockError;
                })

            const res = await request(app)
                .get(`/history/${longUsername}`)
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Username exceeds maximum length')

            findSpy.mockRestore()
        })

        it('should handle error during stats calculation', async () => {
            const mockGames = [
                { result: 'win' },
                { result: 'win' },
                { result: 'loss' }
            ];

            const mockQuery = {
                sort: vi.fn().mockReturnThis(),
                limit: vi.fn().mockResolvedValueOnce(mockGames)
            };

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(mockQuery)

            const res = await request(app)
                .get('/history/history_user')
                .expect(200)

            expect(res.body).toHaveProperty('success', true)
            expect(res.body.stats).toHaveProperty('wins', 2)
            expect(res.body.stats).toHaveProperty('losses', 1)

            findSpy.mockRestore()
        })
    })
});

describe('GET /ranking', () => {
    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }

        await mongoose.connection.collections['users']?.deleteMany({});
        await mongoose.connection.collections['gameresults']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({ username: 'top1', email: 'top1@uniovi.es', password: '123456' })

        await request(app)
            .post('/createuser')
            .send({ username: 'top2', email: 'top2@uniovi.es', password: '123456' })

        await request(app)
            .post('/createuser')
            .send({ username: 'top3', email: 'top3@uniovi.es', password: '123456' })

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

    it('should return the ranking ordered by victories', async () => {
        const res = await request(app)
            .get('/ranking')
            .expect(200)

        expect(res.body).toHaveProperty('success', true)
        expect(res.body).toHaveProperty('ranking')
        expect(Array.isArray(res.body.ranking)).toBe(true)

        const ranking = res.body.ranking
        expect(ranking.length).toBeGreaterThanOrEqual(2)

        if (ranking.length > 0 && ranking[0]?.username === 'top1') {
            expect(ranking[0].wins).toBe(3)
        }
        if (ranking.length > 1 && ranking[1]?.username === 'top2') {
            expect(ranking[1].wins).toBe(2)
        }
    })

    describe('GET /ranking - Error handling', () => {
        beforeAll(async () => {
            if (!isConnected) {
                const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
                await mongoose.connect(TEST_URI);
                isConnected = true;
            }
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a database error occurs during aggregation', async () => {
            const mockError = new Error('Database connection failed during ranking aggregation');

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed during ranking aggregation')

            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in GET /ranking:',
                mockError
            )

            aggregateSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 when there is an error in the aggregation pipeline', async () => {
            const mockError = new Error('Aggregation pipeline failed: $match stage error');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Aggregation pipeline failed: $match stage error')

            aggregateSpy.mockRestore()
        })

        it('should return 500 when there is an error in the $group stage', async () => {
            const mockError = new Error('$group stage failed: invalid accumulator expression');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('$group stage failed: invalid accumulator expression')

            aggregateSpy.mockRestore()
        })

        it('should return 500 when there is an error in the $sort stage', async () => {
            const mockError = new Error('$sort stage failed: memory limit exceeded');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('$sort stage failed: memory limit exceeded')

            aggregateSpy.mockRestore()
        })

        it('should return 500 when there is an error in the $limit stage', async () => {
            const mockError = new Error('$limit stage failed: invalid limit value');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('$limit stage failed: invalid limit value')

            aggregateSpy.mockRestore()
        })

        it('should return 500 when there is an error in the $project stage', async () => {
            const mockError = new Error('$project stage failed: invalid projection');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('$project stage failed: invalid projection')

            aggregateSpy.mockRestore()
        })

        it('should return 500 with different error messages', async () => {
            const errorMessages = [
                'MongoDB server not available',
                'Network error during aggregation',
                'Authentication failed for database',
                'Collection "gameresults" does not exist',
                'Database timeout exceeded',
                'Memory limit exceeded during aggregation',
                'Invalid pipeline operator'
            ]

            for (const errorMessage of errorMessages) {
                const mockError = new Error(errorMessage);

                const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                    .mockRejectedValueOnce(mockError)

                const res = await request(app)
                    .get('/ranking')
                    .expect(500)

                expect(res.body.error).toBe(errorMessage)

                aggregateSpy.mockRestore()
            }
        })

        it('should handle non-Error objects thrown during aggregation', async () => {
            const nonErrorObject = {
                message: 'Custom aggregation error',
                code: 'AGGREGATION_ERROR',
                stage: '$group',
                details: 'Failed to group by username'
            };

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(nonErrorObject)

            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body).toHaveProperty('error')
            expect(typeof res.body.error).toBe('string')

            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in GET /ranking:',
                nonErrorObject
            )

            aggregateSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should handle error when there are no games in the collection', async () => {
            await mongoose.connection.collections['gameresults']?.deleteMany({});

            const res = await request(app)
                .get('/ranking')
                .expect(200)

            expect(res.body).toHaveProperty('success', true)
            expect(res.body).toHaveProperty('ranking')
            expect(Array.isArray(res.body.ranking)).toBe(true)
            expect(res.body.ranking.length).toBe(0)
        })

        it('should handle error when there are wins but aggregation fails due to data type mismatch', async () => {
            const mockError = new Error('Cannot group by username: field has mixed types');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Cannot group by username: field has mixed types')

            aggregateSpy.mockRestore()
        })

        it('should handle error during $match stage when result field is missing', async () => {
            const mockError = new Error('$match stage failed: field "result" does not exist');

            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('$match stage failed: field "result" does not exist')

            aggregateSpy.mockRestore()
        })
    })
});

describe('GET /health', () => {
    it('should return the server status', async () => {
        const res = await request(app)
            .get('/health')
            .expect(200)

        expect(res.body).toHaveProperty('status', 'OK')
        expect(res.body).toHaveProperty('server', 'running')
        expect(res.body).toHaveProperty('database')
        expect(res.body).toHaveProperty('timestamp')
    })
});

describe('POST /login', () => {
    beforeAll(async () => {
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }
    });

    beforeEach(async () => {
        await mongoose.connection.collections['users']?.deleteMany({});

        await request(app)
            .post('/createuser')
            .send({
                username: 'login_user',
                email: 'login@uniovi.es',
                password: '123456'
            });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('should login correctly with valid credentials', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'login_user',
                password: '123456'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('success', true);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toMatch(/Welcome login_user/i);
        expect(res.body).toHaveProperty('user');
        expect(res.body.user).toHaveProperty('username', 'login_user');
        expect(res.body.user).toHaveProperty('email', 'login@uniovi.es');
    });

    it('should return 400 when username is missing', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                password: '123456'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body.error).toBe('Username and password are mandatory');
    });

    it('should return 400 when password is missing', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'login_user'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(400);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body.error).toBe('Username and password are mandatory');
    });

    it('should return 404 when user does not exist', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'unknown_user',
                password: '123456'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(404);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body.error).toBe('User not found');
    });

    it('should return 401 when password is incorrect', async () => {
        const res = await request(app)
            .post('/login')
            .send({
                username: 'login_user',
                password: 'wrong_password'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(401);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body.error).toBe('Invalid credentials');
    });

    it('should return 500 when database error occurs during login', async () => {
        const mockError = new Error('Database error in login');
        const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
            .mockRejectedValueOnce(mockError);

        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

        const res = await request(app)
            .post('/login')
            .send({
                username: 'login_user',
                password: '123456'
            })
            .set('Accept', 'application/json');

        expect(res.status).toBe(500);
        expect(res.body).toHaveProperty('success', false);
        expect(res.body.error).toBe('Internal server error');

        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(consoleErrorSpy).toHaveBeenCalledWith('Error in POST /login:', mockError);

        findOneSpy.mockRestore();
        consoleErrorSpy.mockRestore();
    });
});

afterAll(async () => {
    if (isConnected) {
        await mongoose.connection.close();
    }
});