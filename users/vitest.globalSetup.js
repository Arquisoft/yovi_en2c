// vitest.globalSetup.js
// Runs once after all test suites complete.
// Drops the _test database so no leftover data accumulates between CI runs.
import mongoose from 'mongoose'
import dotenv from 'dotenv'

dotenv.config()

function buildTestUri(uri) {
    if (/\/[^/?]+\?/.test(uri)) {
        return uri.replace(/\/([^/?]+)\?/, '/$1_test?')
    }
    if (/\/[^/?]+$/.test(uri)) {
        return uri.replace(/\/([^/?]+)$/, '/$1_test')
    }
    return uri.replace(/\/$/, '') + '/usersdb_test'
}

export async function teardown() {
    const uri = process.env.MONGODB_URI
    if (!uri) return

    const testUri = buildTestUri(uri)

    try {
        await mongoose.connect(testUri)
        await mongoose.connection.dropDatabase()
        console.log('Test database dropped successfully')
    } catch (err) {
        console.error('Failed to drop test database:', err)
    } finally {
        await mongoose.connection.close()
    }
}