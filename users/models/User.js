const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    username: {
        type: String,
        required: [true, 'Username name is mandatory'],
        unique: true,
        trim: true,
        minlength: [3, 'Username must be at least 3 characters long']
    },
    role: {
        type: String,
        enum: ['user', 'admin'],
        default: 'user',
    },
    email: {
        type: String,
        sparse: true,
        lowercase: true,
        validate: {
            validator: function(v) {
                if (!v) return true;

                const parts = v.split('@');
                if (parts.length !== 2) return false;

                const localPart = parts[0];
                const domainPart = parts[1];

                if (localPart.length === 0 || domainPart.length === 0) return false;

                const domainParts = domainPart.split('.');
                if (domainParts.length < 2) return false;

                for (const part of domainParts) {
                    if (part.length === 0) return false;
                }

                return true;
            },
            message: 'Please insert a valid email'
        }
    },
    realName: {
        type: String,
        trim: true,
        maxlength: [60, 'Real name must be at most 60 characters']
    },
    bio: {
        type: String,
        trim: true,
        maxlength: [280, 'Bio must be at most 280 characters']
    },
    location: {
        city: { type: String, trim: true, maxlength: 60 },
        country: { type: String, trim: true, maxlength: 60 }
    },
    preferredLanguage: {
        type: String,
        enum: ['es', 'en'],
        default: 'en'
    },
    password: {
        type: String,
        required: [true, 'Password is mandatory'],
        minlength: [4, 'Password must be at least 4 characters long']
    },
    // Array of usernames of accepted friends
    friends: {
        type: [String],
        default: []
    },
    // Array of usernames who sent a pending friend request to this user
    friendRequests: {
        type: [String],
        default: []
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

const User = mongoose.model('User', userSchema);

module.exports = User;