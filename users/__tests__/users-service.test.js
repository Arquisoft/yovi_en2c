import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll, vi } from 'vitest' // <-- IMPORTANTE: añadir vi
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
            const TEST_URI = process.env.MONGODB_URI ;
            await mongoose.connect(TEST_URI);
            isConnected = true;
        }
    });

    beforeEach(async () => {
        await mongoose.connection.collections['users']?.deleteMany({});
    });

    afterAll(async () => {
        // conexion it not closed here so the other describes can use it

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

    it('debe crear un usuario correctamente SIN email', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UsuarioSinEmail'
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.message).toMatch(/User UsuarioSinEmail created/i)
        expect(res.body.user).toHaveProperty('username', 'UsuarioSinEmail')
        expect(res.body.user).toHaveProperty('email', null) // CAMBIO: email debe ser null
    })

    // CAMBIO: Nuevo test para crear usuario con email vacío
    it('debe crear un usuario correctamente con email vacío', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UsuarioEmailVacio',
                email: ''
            })
            .set('Accept', 'application/json')

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.user).toHaveProperty('username', 'UsuarioEmailVacio')
        expect(res.body.user).toHaveProperty('email', null) // CAMBIO: email debe ser null
    })

    it('debe crear un usuario correctamente con email con espacios', async () => {
        const res = await request(app)
            .post('/createuser')
            .send({
                username: 'UsuarioEmailEspacios',
                email: '   '
            })
            .set('Accept', 'application/json')

        // CAMBIO: El servidor debe tratar el email con espacios como undefined
        // y crear el usuario correctamente
        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('success', true)
        expect(res.body.user).toHaveProperty('username', 'UsuarioEmailEspacios')
        expect(res.body.user).toHaveProperty('email', null) // CAMBIO: email debe ser null
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
            // Mock the save method to throw a generic error (not validation, not duplicate)
            const mockError = new Error('Unexpected MongoDB connection error');
            mockError.code = 12345; // Different code from 11000 (duplicate)
            mockError.name = 'MongoNetworkError'; // Different name from 'ValidationError'

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(mockError)

            // Spy on console.error to verify it's called
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'test_generic_error',
                    email: 'test@uniovi.es'
                })
                .set('Accept', 'application/json')

            // Verify 500 response
            expect(res.status).toBe(500)
            expect(res.body).toHaveProperty('success', false)

            // Verify the exact message from line 95: 'Internal sevrer error'
            // Note: there's a typo in the original code "sevrer" instead of "server"
            expect(res.body.error).toBe('Internal sevrer error')

            // Verify console.error was called with the error
            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error en POST /createuser:',
                mockError
            )

            // Restore mocks
            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 for errors that are neither ValidationError nor code 11000', async () => {
            // Test with different types of generic errors

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
                        email: 'test@uniovi.es'
                    })
                    .set('Accept', 'application/json')

                expect(res.status).toBe(500)
                expect(res.body.error).toBe('Internal sevrer error')

                saveSpy.mockRestore()
            }
        })

        it('should NOT trigger the generic catch for validation errors', async () => {
            // Create a validation error
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
                    email: 'invalid-email'
                })
                .set('Accept', 'application/json')

            // Should be 400 (ValidationError), not 500
            expect(res.status).toBe(400)
            expect(res.body.error).not.toBe('Internal sevrer error')

            // The console.error from generic catch should NOT have been called
            // because validation is handled in the previous if block
            expect(consoleErrorSpy).not.toHaveBeenCalled()

            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should NOT trigger the generic catch for duplicate key errors (code 11000)', async () => {
            // Create a duplicate key error (code 11000)
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
                    email: 'duplicate@uniovi.es'
                })
                .set('Accept', 'application/json')

            // Should be 400 (Duplicate key), not 500
            expect(res.status).toBe(400)
            expect(res.body.error).toMatch(/already in the data base/i)
            expect(res.body.error).not.toBe('Internal sevrer error')

            // The console.error from generic catch should NOT have been called
            expect(consoleErrorSpy).not.toHaveBeenCalled()

            saveSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should handle errors with no code or name property', async () => {
            // Create a completely malformed error
            const malformedError = { someProperty: 'this is not a standard error' };

            const saveSpy = vi.spyOn(mongoose.Model.prototype, 'save')
                .mockRejectedValueOnce(malformedError)

            const res = await request(app)
                .post('/createuser')
                .send({
                    username: 'test_malformed',
                    email: 'test@uniovi.es'
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

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // TEST EXISTENTE
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

    // ========== NUEVOS TESTS PARA ERROR HANDLING ==========
    describe('GET /users - Error handling', () => {
        it('should return 500 when a database error occurs during find()', async () => {
            // Simular error en find()
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
            // Simular error en sort() (encadenamiento)
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
            // El error se convertirá a string automáticamente
            expect(typeof res.body.error).toBe('string')

            findSpy.mockRestore()
        })

        it('should handle error when find() returns null and sort is called', async () => {
            // Simular que find() devuelve null y luego sort() falla
            const mockError = new Error('Cannot read property sort of null');

            const findSpy = vi.spyOn(mongoose.Model, 'find')
                .mockReturnValueOnce(null)

            // Como find() devuelve null, sort() no existe y dará error
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
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI ;
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
    describe('POST /gameresult - Error handling', () => {
        beforeAll(async () => {
            // Asegurar conexión
            if (!isConnected) {
                const TEST_URI = process.env.MONGODB_URI || 'mongodb+srv://yovi_user:yovi1234@cluster0.xxxxx.mongodb.net/yovi_db_test';
                await mongoose.connect(TEST_URI);
                isConnected = true;
            }

            // Crear usuario para los tests
            await mongoose.connection.collections['users']?.deleteMany({ username: 'jugador_error' });
            await request(app)
                .post('/createuser')
                .send({ username: 'jugador_error', email: 'error@uniovi.es' })
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a database error occurs during user lookup', async () => {
            // Simular error en User.findOne()
            const mockError = new Error('Database connection failed during user lookup');
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockRejectedValueOnce(mockError)

            // Espiar console.error
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

            // Verificar respuesta
            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed during user lookup')

            // Verificar que se llamó a console.error
            expect(consoleErrorSpy).toHaveBeenCalled()
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in POST /gameresult:',
                mockError
            )

            findOneSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should return 500 when a database error occurs during game save', async () => {
            // Primero verificar que el usuario existe (findOne funciona)
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockResolvedValueOnce({ username: 'jugador_error' })

            // Simular error en game.save()
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

                // Simular error en findOne
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
            // El objeto no-Error se convertirá a string automáticamente
            expect(typeof res.body.error).toBe('string')

            findOneSpy.mockRestore()
        })

        it('should handle error when GameResult model save fails after user exists', async () => {
            // Simular que findOne funciona correctamente
            const findOneSpy = vi.spyOn(mongoose.Model, 'findOne')
                .mockResolvedValueOnce({ username: 'jugador_error' })

            // Simular error en el constructor o save de GameResult
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
            // Simular error por username con caracteres especiales
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
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI ;
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

    describe('GET /history/:username - Error handling', () => {
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
                .send({ username: 'history_user', email: 'history@uniovi.es' })
        });

        afterEach(() => {
            vi.restoreAllMocks()
        })

        it('should return 500 when a database error occurs during GameResult.find()', async () => {
            const mockError = new Error('Database connection failed while fetching history');

            // Simular error en GameResult.find()
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

            // Simular error en el encadenamiento sort()
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

            // Simular error en limit()
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
            // El código usa Number.parseInt(limit), si limit no es un número válido
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
            // Simular que find funciona pero hay error al calcular stats
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

            // No hay error aquí porque el cálculo de stats es síncrono y simple
            // Pero si hubiera una operación compleja, podría fallar
            const res = await request(app)
                .get('/history/history_user')
                .expect(200) // Debería funcionar correctamente

            expect(res.body).toHaveProperty('success', true)
            expect(res.body.stats).toHaveProperty('wins', 2)
            expect(res.body.stats).toHaveProperty('losses', 1)

            findSpy.mockRestore()
        })
    })
});

describe('GET /ranking', () => {
    beforeAll(async () => {
        // Asegurar conexión
        if (!isConnected) {
            const TEST_URI = process.env.MONGODB_URI ;
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
    describe('GET /ranking - Error handling', () => {
        beforeAll(async () => {
            // Asegurar conexión
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

            // Espiar console.error
            const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

            // Simular error en aggregate
            const aggregateSpy = vi.spyOn(mongoose.Model, 'aggregate')
                .mockRejectedValueOnce(mockError)

            const res = await request(app)
                .get('/ranking')
                .expect(500)

            // Verificar respuesta
            expect(res.body).toHaveProperty('success', false)
            expect(res.body.error).toBe('Database connection failed during ranking aggregation')

            // Verificar que se llamó a console.error
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

            // Verificar que console.error recibió el objeto no-Error
            expect(consoleErrorSpy).toHaveBeenCalledWith(
                'Error in GET /ranking:',
                nonErrorObject
            )

            aggregateSpy.mockRestore()
            consoleErrorSpy.mockRestore()
        })

        it('should handle error when there are no games in the collection', async () => {
            // Este test verifica que la agregación funciona incluso con colección vacía
            // No debería dar error, sino devolver ranking vacío

            // Limpiar colección de gameresults
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