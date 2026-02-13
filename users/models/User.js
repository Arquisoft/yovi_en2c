//  usa db.js - Conexión a MongoDB Atlas
const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username : {
        type: String,
        required: [true, 'Username name is mandatory'],
        unique: true,
        trim: true, // e
        minlength: [3, 'Username must be at least 3 characters long']
    },
    email: {
        type: String,
        unique: true,
        lowercase: true, // converts to lowercase
        match: [/^\S+@\S+\.\S+$/, 'Please insert a valid email']
    },
    createdAt: {
        type: Date,
        default: Date.now // auto
    }
    }, {
    timestamps: true // create at and update at are automatically generated
});
const User = mongoose.model('User', userSchema);

module.exports = User;