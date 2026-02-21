import { createModel } from '../../database/mongodb/model-factory.js';

/**
 * ChatHistory Model
 * Stores Discord chat history for bot memory per user/channel/guild
 */
const ChatHistory = createModel('ChatHistory', {
    // Discord IDs
    guildId: {
        type: String,
        required: true,
        index: true
    },
    channelId: {
        type: String,
        required: true,
        index: true
    },
    userId: {
        type: String,
        required: true,
        index: true
    },
    
    // User info (denormalized for quick access)
    username: {
        type: String,
        required: true
    },
    userTag: {
        type: String,
        required: true
    },
    userAvatar: {
        type: String
    },
    
    // Message data
    messageId: {
        type: String,
        required: true,
        unique: true
    },
    content: {
        type: String,
        required: true
    },
    
    // Message metadata
    role: {
        type: String,
        enum: ['user', 'bot', 'system'],
        default: 'user'
    },
    
    // For threading/conversations
    conversationId: {
        type: String,
        index: true
    },
    replyToMessageId: {
        type: String
    },
    
    // Attachments
    attachments: [{
        url: String,
        name: String,
        contentType: String
    }],
    
    // Bot response metadata
    botResponseTime: {
        type: Number // ms
    },
    
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false
    }
}, {
    // Compound indexes for efficient queries
    indexes: [
        { guildId: 1, channelId: 1, createdAt: -1 },
        { userId: 1, createdAt: -1 },
        { conversationId: 1, createdAt: 1 }
    ]
});

export default ChatHistory;
