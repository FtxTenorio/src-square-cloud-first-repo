/**
 * ChannelMood Model
 * Persists Frieren's mood state per channel
 */

import mongoose from 'mongoose';

const channelMoodSchema = new mongoose.Schema({
    channelId: { 
        type: String, 
        required: true, 
        unique: true,
        index: true
    },
    guildId: {
        type: String,
        default: 'DM'
    },
    currentMood: { 
        type: String, 
        enum: ['friendly', 'sage', 'brava', 'chorona'],
        default: 'friendly'
    },
    velhaCounter: {
        type: Number,
        default: 0,
        min: 0,
        max: 3
    },
    lastChange: {
        type: Date,
        default: Date.now
    },
    messagesSinceMoodChange: {
        type: Number,
        default: 0
    },
    // Stats for fun
    stats: {
        totalMoodChanges: { type: Number, default: 0 },
        timesChorona: { type: Number, default: 0 },
        timesBrava: { type: Number, default: 0 },
        timesCalledVelha: { type: Number, default: 0 }
    }
}, { 
    timestamps: true 
});

// Index for cleanup of old entries
channelMoodSchema.index({ updatedAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 }); // 30 days TTL

const ChannelMood = mongoose.models.ChannelMood || mongoose.model('ChannelMood', channelMoodSchema);

export default ChannelMood;
