import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import mongoose from 'mongoose'
import { teardown } from '../vitest.globalSetup.js'

// buildTestUri is not exported — we test it indirectly through teardown(),
// verifying which URI mongoose.connect() is called with.

describe('vitest.globalSetup.js — buildTestUri & teardown', () => {
    let mockConnect
    let mockDropDatabase
    let mockClose
    let mockConsoleLog
    let mockConsoleError

    beforeEach(() => {
        mockDropDatabase = vi.fn().mockResolvedValue(undefined)
        mockClose = vi.fn().mockResolvedValue(undefined)
        mockConnect = vi.spyOn(mongoose, 'connect').mockResolvedValue(undefined)

        vi.spyOn(mongoose.connection, 'dropDatabase', 'get').mockReturnValue(mockDropDatabase)
        vi.spyOn(mongoose.connection, 'close', 'get').mockReturnValue(mockClose)

        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    // ── buildTestUri: URI with query string ───────────────────────────────────

    it('appends _test to dbname when URI has dbname and query string', async () => {
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test?ssl=true')
    })

    it('handles multi-host URI with dbname and query string', async () => {
        process.env.MONGODB_URI = 'mongodb://h1:27017,h2:27017,h3:27017/usersdb?ssl=true&replicaSet=rs0'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb://h1:27017,h2:27017,h3:27017/usersdb_test?ssl=true&replicaSet=rs0'
        )
    })

    it('handles mongodb+srv URI with query string', async () => {
        process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/usersdb?retryWrites=true'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb+srv://user:pass@cluster.mongodb.net/usersdb_test?retryWrites=true'
        )
    })

    // ── buildTestUri: URI without query string ────────────────────────────────

    it('appends _test to dbname when URI has no query string', async () => {
        process.env.MONGODB_URI = 'mongodb://host/usersdb'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test')
    })

    it('handles mongodb+srv URI without query string', async () => {
        process.env.MONGODB_URI = 'mongodb+srv://user:pass@cluster.mongodb.net/mydb'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith(
            'mongodb+srv://user:pass@cluster.mongodb.net/mydb_test'
        )
    })

    // ── buildTestUri: URI without dbname (fallback) ───────────────────────────

    it('appends /usersdb_test when URI has trailing slash only', async () => {
        process.env.MONGODB_URI = 'mongodb://host/'

        await teardown()

        expect(mockConnect).toHaveBeenCalledWith('mongodb://host/usersdb_test')
    })

    // ── teardown: no-op when MONGODB_URI is missing ───────────────────────────

    it('does nothing when MONGODB_URI is not defined', async () => {
        delete process.env.MONGODB_URI

        await teardown()

        expect(mockConnect).not.toHaveBeenCalled()
        expect(mockDropDatabase).not.toHaveBeenCalled()
    })

    // ── teardown: happy path ──────────────────────────────────────────────────

    it('drops the database and closes the connection on success', async () => {
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'

        await teardown()

        expect(mockDropDatabase).toHaveBeenCalledTimes(1)
        expect(mockClose).toHaveBeenCalledTimes(1)
        expect(mockConsoleLog).toHaveBeenCalledWith('Test database dropped successfully')
    })

    it('always closes the connection even when dropDatabase fails', async () => {
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'
        mockDropDatabase.mockRejectedValueOnce(new Error('Drop failed'))

        await teardown()

        expect(mockClose).toHaveBeenCalledTimes(1)
        expect(mockConsoleError).toHaveBeenCalledWith(
            'Failed to drop test database:',
            expect.any(Error)
        )
    })

    it('always closes the connection even when connect fails', async () => {
        process.env.MONGODB_URI = 'mongodb://host/usersdb?ssl=true'
        mockConnect.mockRejectedValueOnce(new Error('Connect failed'))

        await teardown()

        expect(mockClose).toHaveBeenCalledTimes(1)
        expect(mockConsoleError).toHaveBeenCalledWith(
            'Failed to drop test database:',
            expect.any(Error)
        )
    })
})
