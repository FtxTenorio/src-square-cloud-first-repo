/**
 * Nexus AI Engine
 * Main AI module that orchestrates responses
 */

import logger from '../utils/logger.js';
import { getPersonality, getAllPersonalities, PERSONALITIES } from './personalities.js';
import { matchPattern } from './patterns.js';
import { analyzeSentiment, getSentimentResponses } from './sentiment.js';
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
            logger.ai.fallback();
            // Fall through to local response
        }
    }
    
    // 3. Fallback to sentiment-based local response
    const sentiment = analyzeSentiment(content);
    const response = getSentimentResponses(sentiment, personality.emoji);
    
    const contextual = updateContext(userId, channelId, content);
    
    if (contextual.addNote) {
        return `${response}\n\n_${contextual.note}_`;
    }
    
    return response;
}

/**
 * Extract topics from message (for context tracking)
 */
export function extractTopics(text) {
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set([
        'o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 
        'para', 'com', 'que', 'e', 'é', 'não', 'sim', 'mas', 'ou',
        'se', 'por', 'como', 'mais', 'ao', 'já', 'muito', 'pode'
    ]);
    
    return words
        .filter(w => w.length > 3 && !stopWords.has(w))
        .slice(0, 5);
}

// Export everything
export default {
    generateResponse,
    getUserPersonality,
    setUserPersonality,
    getAvailablePersonalities,
    clearContext,
    extractTopics,
    PERSONALITIES
};
