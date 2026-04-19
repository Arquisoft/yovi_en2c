import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// buildConnectionUri is not exported — we test it indirectly by setting
// NODE_ENV and MONGODB_URI, then importing db.js and checking which URI
// mongoose.connect() was called with.

describe('db.js — buildConnectionUri', () => {
    let mockConnect
    let mockExit
    let mockConsoleLog
    let mockConsoleError

    beforeEach(() => {
        vi.resetModules()
        mockConnect = vi.spyOn(require('mongoose'), 'connect').mockResolvedValue()
        mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
        delete process.env.NODE_ENV
    })

    // ── Non-test environment — URI returned unchanged ─────────────────────────

    it('returns the URI unchanged when NODE_ENV is not test', async () => {
        process.env.NODE_ENV = 'production'
        process.env.MONGODB_URI = 'mongodb://host/mydb?ssl=true'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/mydb?ssl=true')
    })

    it('returns the URI unchanged when NODE_ENV is development', async () => {
        process.env.NODE_ENV = 'development'
        process.env.MONGODB_URI = 'mongodb://host/mydb'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/mydb')
    })

    it('returns the URI unchanged when NODE_ENV is undefined', async () => {
        delete process.env.NODE_ENV
        process.env.MONGODB_URI = 'mongodb://host/mydb?ssl=true'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/mydb?ssl=true')
    })

    // ── Test environment — URI with query string ──────────────────────────────

    it('appends _test to dbname when URI has dbname and query string', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test?ssl=true')
    })

    it('handles multi-host URI with dbname and query string', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://h1:27017,h2:27017,h3:27017/usersdb?ssl=true&replicaSet=rs0'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb://h1:27017,h2:27017,h3:27017/usersdb_test?ssl=true&replicaSet=rs0'
        )
    })

    it('handles mongodb+srv URI with query string', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/usersdb?retryWrites=true'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb+srv://user:pass@cluster.mongodb.net/usersdb_test?retryWrites=true'
        )
    })

    // ── Test environment — URI without query string ───────────────────────────

    it('appends _test to dbname when URI has no query string', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://host/usersdb'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test')
    })

    it('handles mongodb+srv URI without query string', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/mydb'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb+srv://user:pass@cluster.mongodb.net/mydb_test'
        )
    })

    // ── Test environment — URI without dbname (fallback) ─────────────────────

    it('appends /usersdb_test when URI has no database name (trailing slash)', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://host/'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test')
    })

    // ── Missing MONGODB_URI ───────────────────────────────────────────────────

    it('calls process.exit(1) when MONGODB_URI is not defined', async () => {
        delete process.env.MONGODB_URI

        await import('../db.js')
        await new Promise(r => setTimeout(r, 20))

        expect(mockExit).toHaveBeenCalledWith(1)
        expect(mockConsoleError).toHaveBeenCalledWith('MongoDB URL not found in variables')
    })

    // ── Connection error ──────────────────────────────────────────────────────

    it('calls process.exit(1) and logs error when connect rejects', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'
        const err = new Error('Connection refused')
        mockConnect.mockRejectedValueOnce(err)

        await import('../db.js')
        await new Promise(r => setTimeout(r, 50))

        expect(mockConsoleError).toHaveBeenCalledWith('Conection to MongoDB : ERROR ->')
        expect(mockConsoleError).toHaveBeenCalledWith(err)
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    // ── Successful connection ─────────────────────────────────────────────────

    it('logs success message when connect resolves', async () => {
        process.env.NODE_ENV = 'test'
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'

        await import('../db.js')
        await new Promise(r => setTimeout(r, 50))

        expect(mockConsoleLog).toHaveBeenCalledWith('Conection to MongoDB : CORRECT ')
        expect(mockExit).not.toHaveBeenCalled()
    })
})
