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
        sparse: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                if (!v) return true; // Allow empty emails due to sparse:tru
                const parts = v.split('@');
                if (parts.length !== 2) return false;
                const [local, domain] = parts;

                if (local.length === 0 || local.length > 64) return false;
                if (domain.length === 0 || domain.length > 255) return false;

                const domainParts = domain.split('.');
                if (domainParts.length < 2) return false;

                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return emailRegex.test(v);
            },
            message: 'Please insert a valid email'
        }
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