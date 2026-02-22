/**
 * Nexus AI Engine
 * Main AI module that orchestrates responses
 */

import logger from '../utils/logger.js';
import { getPersonality, getAllPersonalities, PERSONALITIES } from './personalities.js';
import { matchPattern } from './patterns.js';
import * as openai from './providers/openai.js';
import moodEngine from './moodEngine.js';

// Conversation context storage
const conversationContext = new Map();

// Per-user personality override (from /personality command). userId -> personalityId
const userPersonalities = new Map();

/**
 * Set preferred personality for a user (from /personality command)
 */
export function setUserPersonality(userId, personalityId) {
    if (personalityId) {
        userPersonalities.set(userId, personalityId);
    } else {
        userPersonalities.delete(userId);
    }
}

/**
 * Get user's preferred personality id, or null if not set
 */
export function getUserPersonality(userId) {
    return userPersonalities.get(userId) || null;
}

/**
 * Get available personalities for commands
 */
export function getAvailablePersonalities() {
    return getAllPersonalities().map(p => ({
        id: p.id,
        name: p.name,
        emoji: p.emoji,
        description: p.description
    }));
}

/**
 * Track conversation context
 */
function updateContext(userId, channelId, message) {
    const key = `${userId}-${channelId}`;
    let context = conversationContext.get(key) || { 
        messageCount: 0, 
        topics: [],
        lastTimestamp: null 
    };
    
    context.messageCount++;
    context.lastMessage = message;
    context.lastTimestamp = Date.now();
    
    conversationContext.set(key, context);
    
    return { addNote: false };
}

/**
 * Clear user context
 */
export function clearContext(userId, channelId) {
    const key = `${userId}-${channelId}`;
    conversationContext.delete(key);
}

/**
 * Main response generator
 * Orchestrates mood analysis, pattern matching, and AI providers
 * Returns { content, moodResult } for status tracking
 * 
 * IMPORTANT: If mood changed, content will be null - only send transitionMessage
 * This saves AI tokens and feels more natural
 */
export async function generateResponse(message, history = [], options = {}) {
    const userId = message.author?.id || message.userId || 'unknown';
    const channelId = message.channel?.id || message.channelId || 'unknown';
    const content = (message.content || '').trim();
    
    // 1. Analyze mood based on message (per channel)
    const moodResult = await moodEngine.analyzeMood(channelId, content);
    
    // If mood changed, don't generate AI response - just return the transition
    // Next message will use the new mood naturally
    if (moodResult.changed && moodResult.transitionMessage) {
        logger.debug('AI', `Humor mudou para ${moodResult.mood} - pulando resposta IA`);
        return {
            content: null, // No AI response needed
            moodResult
        };
    }
    
    // Prefer user's chosen personality (from /personality) over channel mood
    const userPersonalityId = getUserPersonality(userId);
    const personality = getPersonality(userPersonalityId || moodResult.mood);
    
    // Update context
    updateContext(userId, channelId, content);
    
    // 2. Try pattern matching first (fastest)
    const patternMatch = matchPattern(content, moodResult.mood);
    if (patternMatch.matched) {
        logger.debug('AI', `Pattern match: ${patternMatch.patternId}`);
        
        return {
            content: patternMatch.response,
            moodResult
        };
    }
    
    // 3. Try OpenAI if configured
    if (openai.isConfigured()) {
        try {
            const result = await openai.generateResponse(content, personality, history);
            
            return {
                content: result.content,
                moodResult
            };
        } catch (error) {
            logger.ai.error(error);
            return {
                content: getSleepingMessage(),
                moodResult
            };
        }
    }
    
    // 4. Fallback - Frieren está dormindo
    return {
        content: getSleepingMessage(),
        moodResult
    };
}

/**
 * Get current mood for a channel
 */
export async function getChannelMood(channelId) {
    return await moodEngine.getCurrentMood(channelId);
}

/**
 * Force set mood for a channel
 */
export async function setChannelMood(channelId, mood, guildId = null) {
    return await moodEngine.setMood(channelId, mood, guildId);
}

/**
 * Get sleeping Frieren message
 */
function getSleepingMessage() {
    const sleepingMessages = [
        '💤 *Frieren está dormindo... Afinal, elfos precisam de descanso também (mesmo que seja por alguns séculos).*',
        '😴 *Frieren adormeceu enquanto meditava. Volte daqui a uns 10 anos, talvez ela acorde.*',
        '🌙 *A maga está em um sono profundo. Himmel diria para ter paciência...*',
        '💤 *Zzz... Frieren está tirando uma soneca. Para ela, "uma soneca" pode significar algumas décadas.*',
        '😪 *Frieren não está disponível no momento. Ela encontrou um lugar confortável para dormir.*',
        '🧝‍♀️💤 *"Só vou descansar os olhos por um momento..." - Frieren, há 3 dias atrás.*',
        '🌸 *Frieren está dormindo sob uma árvore de cerejeira. Ela prometeu acordar na próxima primavera... de qual século, ela não especificou.*',
        '📚💤 *Frieren adormeceu lendo um grimório. A magia de IA está temporariamente indisponível.*'
    ];
    
    return sleepingMessages[Math.floor(Math.random() * sleepingMessages.length)];
}

// Export everything
export default {
    generateResponse,
    getAvailablePersonalities,
    getChannelMood,
    setChannelMood,
    clearContext,
    setUserPersonality,
    getUserPersonality,
    PERSONALITIES,
    moodEngine
};
