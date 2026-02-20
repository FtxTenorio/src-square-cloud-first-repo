/**
 * Nexus AI Engine
 * Main AI module that orchestrates responses
 */

import logger from '../utils/logger.js';
import { getPersonality, getAllPersonalities, PERSONALITIES } from './personalities.js';
import { matchPattern } from './patterns.js';
import * as openai from './providers/openai.js';

// User preferences storage (in-memory, will be moved to DB)
const userPreferences = new Map();

// Conversation context storage
const conversationContext = new Map();

/**
 * Get user's personality preference
 */
export function getUserPersonality(userId) {
    return userPreferences.get(userId) || 'friendly';
}

/**
 * Set user's personality preference
 */
export function setUserPersonality(userId, personalityId) {
    if (PERSONALITIES[personalityId]) {
        userPreferences.set(userId, personalityId);
        logger.debug('AI', `Personalidade de ${userId} alterada para ${personalityId}`);
        return true;
    }
    return false;
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
    
    // Add contextual note every 5 messages
    if (context.messageCount > 5 && context.messageCount % 5 === 0) {
        return {
            addNote: true,
            note: `Já trocamos ${context.messageCount} mensagens! Tô gostando dessa conversa 😄`
        };
    }
    
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
 * Orchestrates pattern matching, sentiment analysis, and AI providers
 */
export async function generateResponse(message, history = [], options = {}) {
    const userId = message.author?.id || message.userId || 'unknown';
    const channelId = message.channel?.id || message.channelId || 'unknown';
    const content = (message.content || '').trim();
    
    const personalityId = getUserPersonality(userId);
    const personality = getPersonality(personalityId);
    
    // 1. Try pattern matching first (fastest)
    const patternMatch = matchPattern(content, personalityId);
    if (patternMatch.matched) {
        logger.debug('AI', `Pattern match: ${patternMatch.patternId}`);
        
        const contextual = updateContext(userId, channelId, content);
        let response = patternMatch.response;
        
        if (contextual.addNote) {
            response += `\n\n_${contextual.note}_`;
        }
        
        return response;
    }
    
    // 2. Try OpenAI if configured
    if (openai.isConfigured()) {
        try {
            const result = await openai.generateResponse(content, personality, history);
            
            const contextual = updateContext(userId, channelId, content);
            let response = result.content;
            
            if (contextual.addNote) {
                response += `\n\n_${contextual.note}_`;
            }
            
            return response;
        } catch (error) {
            logger.ai.error(error);
            return getSleepingMessage();
        }
    }
    
    // 3. Fallback - Frieren está dormindo
    return getSleepingMessage();
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
    getUserPersonality,
    setUserPersonality,
    getAvailablePersonalities,
    clearContext,
    PERSONALITIES
};
