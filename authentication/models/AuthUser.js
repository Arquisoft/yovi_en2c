const mongoose = require('mongoose');

const authUserSchema = new mongoose.Schema({

    username: {
        type: String,
        required: true,
        unique: true
    },
    
     email: {
        type: String,
        required: true,
        unique: true
    },

    password: {
        type: String,
        required: true
    }

}, {
    timestamps: true
});

const AuthUser = mongoose.model('AuthUser', authUserSchema);

module.exports = AuthUser;