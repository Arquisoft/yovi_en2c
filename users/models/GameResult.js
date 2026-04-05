// models/GameResult.js - Guarda las partidas
const mongoose = require('mongoose');

const gameResultSchema = new mongoose.Schema({
    username: {
        type: String,
        required: true,
        index: true // for user search
    },
    opponent: {
        type: String,
        required: true
    },
    result: {
        type: String,
        required: true,
        enum: {
            values: ['win', 'loss'],
            message: '{VALUE} is not a valid result'
        }
    },

    winner: {
        type: String,
        default: null
    },
    score: {
        type: Number,
        default: 0,
        min: [0, 'Score can not be negative']
    },

    boardSize: {
        type: Number,
        default: 7,
        min: [1, 'Board size must be at least 1']
    },

    gameMode: {
        type: String,
        enum: {
            values: ['pvb', 'pvp'],
            message: '{VALUE} is not a valid game mode'
        },
        default: 'pvb'
    },
    date: {
        type: Date,
        default: Date.now
    }
});

const GameResult = mongoose.model('GameResult', gameResultSchema);

module.exports = GameResult;