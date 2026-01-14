const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50
    },
    description: {
        type: String,
        trim: true,
        maxlength: 200,
        default: ''
    },
    type: {
        type: String,
        enum: ['public', 'private', 'direct'],
        default: 'public'
    },
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    admins: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    avatar: {
        type: String,
        default: ''
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message'
    }
}, {
    timestamps: true
});

// Get room avatar or default
roomSchema.methods.getAvatar = function() {
    if (this.avatar) return this.avatar;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(this.name)}&background=10b981&color=fff`;
};

module.exports = mongoose.model('Room', roomSchema);
