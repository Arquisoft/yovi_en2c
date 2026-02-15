import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// No hacer mock de mongoose al principio, lo haremos en cada test
describe('db.js', () => {
    const originalEnv = process.env
    let mockExit
    let mockConsoleError
    let mockConsoleLog
    let originalMongooseConnect

    beforeEach(() => {
        // Guardar el connect original
        originalMongooseConnect = vi.spyOn(require('mongoose'), 'connect')

        // Mock process.exit
        mockExit = vi.spyOn(process, 'exit').mockImplementation(() => {})

        // Mock console methods
        mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
        mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})

        // Reset modules
        vi.resetModules()
        process.env = { ...originalEnv }
    })

    afterEach(() => {
        process.env = originalEnv
        vi.restoreAllMocks()
    })




    it('should handle connection error and exit (lines 17-19)', async () => {
        // Arrange
        const testUri = 'mongodb://test-uri'
        process.env.MONGODB_URI = testUri
        const connectionError = new Error('Connection failed')

        // Mock failed connection - usar mockImplementationOnce
        const mongoose = require('mongoose')
        vi.spyOn(mongoose, 'connect').mockImplementationOnce(() => Promise.reject(connectionError))

        // Act
        await import('../db.js')

        // Pequeña pausa
        await new Promise(resolve => setTimeout(resolve, 50))

        // Assert
        expect(mockConsoleError).toHaveBeenCalledWith('Conection to MongoDB : ERROR ->')
        expect(mockConsoleError).toHaveBeenCalledWith(connectionError)
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should handle non-Error objects in connection catch', async () => {
        // Arrange
        const testUri = 'mongodb://test-uri'
        process.env.MONGODB_URI = testUri
        const nonErrorObject = { message: 'Custom error', code: 123 }

        // Mock failed connection with non-Error object
        const mongoose = require('mongoose')
        vi.spyOn(mongoose, 'connect').mockImplementationOnce(() => Promise.reject(nonErrorObject))

        // Act
        await import('../db.js')

        // Pequeña pausa
        await new Promise(resolve => setTimeout(resolve, 50))

        // Assert
        expect(mockConsoleError).toHaveBeenCalledWith('Conection to MongoDB : ERROR ->')
        expect(mockConsoleError).toHaveBeenCalledWith(nonErrorObject)
        expect(mockExit).toHaveBeenCalledWith(1)
    })

    it('should connect successfully when MONGODB_URI is defined', async () => {
        // Arrange
        const testUri = 'mongodb://test-uri'
        process.env.MONGODB_URI = testUri

        // Mock successful connection
        const mongoose = require('mongoose')
        vi.spyOn(mongoose, 'connect').mockImplementationOnce(() => Promise.resolve())

        // Act
        await import('../db.js')

        // Pequeña pausa
        await new Promise(resolve => setTimeout(resolve, 50))

        // Assert
        expect(mockConsoleLog).toHaveBeenCalledWith('Conection to MongoDB : CORRECT ')
        expect(mockExit).not.toHaveBeenCalled()
    })
})