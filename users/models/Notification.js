const mongoose = require('mongoose');

/**
 * Notification model.
 * Designed to be extensible — type can grow beyond "friend_request"
 * without schema changes (e.g. "game_challenge", "system_message").
 */
const notificationSchema = new mongoose.Schema({
    recipient: {
        type: String,
        required: [true, 'Recipient is mandatory'],
        trim: true,
    },
    type: {
        type: String,
        required: [true, 'Type is mandatory'],
        enum: ['friend_request', 'welcome', 'admin_granted', 'admin_revoked'],
        default: 'friend_request',
    },
    from: {
        type: String,
        trim: true,
        default: null,   // null for system notifications (e.g. welcome)
    },
    read: {
        type: Boolean,
        default: false,
    },
    createdAt: {
        type: Date,
        default: Date.now,
    },
}, {
    timestamps: false,   // createdAt is managed manually above
});

// Index to speed up "get all notifications for user" queries
notificationSchema.index({ recipient: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
