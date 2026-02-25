import ChatHistory from '../../../models/ChatHistory.js';
import logger from '../utils/logger.js';

/**
 * ChatHistory Service
 * Manages chat history storage and retrieval for Discord bot
 */

/**
 * Save a message to history
 * @param {object} message - Discord message object
 * @param {string} role - 'user' | 'bot' | 'system'
 * @param {string} conversationId - Optional conversation thread ID
 * @returns {Promise<ChatHistory>}
 */
export async function saveMessage(message, role = 'user', conversationId = null) {
    try {
        const historyEntry = await ChatHistory.create({
            guildId: message.guild?.id || 'DM',
            channelId: message.channel.id,
            userId: message.author.id,
            username: message.author.username,
            userTag: message.author.tag,
            userAvatar: message.author.avatarURL(),
            messageId: message.id,
            content: message.content,
            role,
            conversationId: conversationId || message.channel.id,
            replyToMessageId: message.reference?.messageId || null,
            attachments: message.attachments?.map(a => ({
                url: a.url,
                name: a.name,
                contentType: a.contentType
            })) || []
        });
        
        return historyEntry;
    } catch (error) {
        // Duplicate message (already saved)
        if (error.code === 11000) {
            return null;
        }
        logger.error('AI', 'Erro ao salvar histórico de chat', error.message);
        throw error;
    }
}

/**
 * Save a bot response
 * @param {object} params
 * @returns {Promise<ChatHistory>}
 */
export async function saveBotResponse({ guildId, channelId, messageId, content, replyToMessageId, botResponseTime, conversationId }) {
    try {
        const historyEntry = await ChatHistory.create({
            guildId: guildId || 'DM',
            channelId,
            userId: 'bot',
            username: 'Bot',
            userTag: 'Bot#0000',
            messageId,
            content,
            role: 'bot',
            conversationId: conversationId || channelId,
            replyToMessageId,
            botResponseTime
        });
        
        return historyEntry;
    } catch (error) {
        if (error.code === 11000) return null;
        logger.error('AI', 'Erro ao salvar resposta do bot no histórico', error.message);
        throw error;
    }
}

/**
 * Get chat history for a user in a channel
 * @param {string} userId 
 * @param {string} channelId 
 * @param {number} limit 
 * @returns {Promise<ChatHistory[]>}
 */
export async function getUserHistory(userId, channelId, limit = 50) {
    return ChatHistory.find({
        userId,
        channelId,
        isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get full channel history (all users)
 * @param {string} channelId 
 * @param {number} limit 
 * @returns {Promise<ChatHistory[]>}
 */
export async function getChannelHistory(channelId, limit = 100) {
    return ChatHistory.find({
        channelId,
        isDeleted: false
    })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
}

/**
 * Get conversation thread
 * @param {string} conversationId 
 * @param {number} limit 
 * @returns {Promise<ChatHistory[]>}
 */
export async function getConversation(conversationId, limit = 50) {
    return ChatHistory.find({
        conversationId,
        isDeleted: false
    })
    .sort({ createdAt: 1 }) // Chronological order
    .limit(limit)
    .lean();
}

/**
 * Get recent messages for context (for AI/bot memory)
 * Por servidor + canal: todas as mensagens do canal (todos os usuários + bot).
 * Inclui username para a IA enxergar quem disse o quê no chat.
 * @param {string|null} guildId 
 * @param {string} channelId 
 * @param {number} limit 
 * @returns {Promise<Array<{role: string, content: string, username?: string}>>}
 */
export async function getContextMessages(guildId, channelId, limit = 50) {
    const filter = {
        channelId,
        isDeleted: false
    };

    if (guildId) {
        filter.guildId = guildId;
    }

    const messages = await ChatHistory.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .select('role content createdAt username')
        .lean();

    return messages.reverse().map(m => ({
        role: m.role === 'bot' ? 'assistant' : 'user',
        content: m.content,
        username: m.username || (m.role === 'bot' ? 'Frieren' : null)
    }));
}

/**
 * Get user stats
 * @param {string} userId 
 * @returns {Promise<object>}
 */
export async function getUserStats(userId) {
    const [stats] = await ChatHistory.aggregate([
        { $match: { userId, isDeleted: false } },
        {
            $group: {
                _id: '$userId',
                totalMessages: { $sum: 1 },
                firstMessage: { $min: '$createdAt' },
                lastMessage: { $max: '$createdAt' },
                channels: { $addToSet: '$channelId' },
                guilds: { $addToSet: '$guildId' }
            }
        }
    ]);
    
    return stats || { totalMessages: 0, channels: [], guilds: [] };
}

/**
 * Clear user history in a channel
 * @param {string} userId 
 * @param {string} channelId 
 * @returns {Promise<number>} - Number of messages marked as deleted
 */
export async function clearUserHistory(userId, channelId) {
    const result = await ChatHistory.updateMany(
        { userId, channelId },
        { isDeleted: true }
    );
    return result.modifiedCount;
}

/**
 * Search messages
 * @param {string} query 
 * @param {object} filters 
 * @returns {Promise<ChatHistory[]>}
 */
export async function searchMessages(query, filters = {}) {
    const searchFilter = {
        content: { $regex: query, $options: 'i' },
        isDeleted: false,
        ...filters
    };
    
    return ChatHistory.find(searchFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean();
}

export default {
    saveMessage,
    saveBotResponse,
    getUserHistory,
    getChannelHistory,
    getConversation,
    getContextMessages,
    getUserStats,
    clearUserHistory,
    searchMessages
};
