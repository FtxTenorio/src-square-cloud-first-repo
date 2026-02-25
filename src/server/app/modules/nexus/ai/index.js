/**
 * Nexus AI Engine
 * Main AI module that orchestrates responses
 * Personalidade é por chat (não por usuário).
 */

import logger from '../utils/logger.js';
import { matchPattern } from './patterns.js';
import * as openai from './providers/openai.js';
import moodEngine from './moodEngine.js';
import * as chatService from '../services/chatService.js';
import * as personalityService from '../services/personalityService.js';

// Conversation context storage
const conversationContext = new Map();

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
    const guildId = message.guild?.id || message.guildId || null;
    const content = (message.content || '').trim();
    
    // 1. Analyze mood based on message (per channel)
    const moodResult = await moodEngine.analyzeMood(channelId, content, { guildId });
    
    // If mood changed, don't generate AI response - just return the transition
    // Next message will use the new mood naturally
    if (moodResult.changed && moodResult.transitionMessage) {
        logger.debug('AI', `Humor mudou para ${moodResult.mood} - pulando resposta IA`);
        return {
            content: null, // No AI response needed
            moodResult
        };
    }
    
    // Personalidade do chat. Humor temporário (brava, chorona, sage) sobrescreve a padrão do canal
    const chatPersonality = await chatService.getChatPersonality(channelId, guildId || 'DM');
    const effectiveSlug = moodResult.mood !== 'friendly' ? moodResult.mood : (chatPersonality?.slug || 'friendly');
    const personality = await personalityService.getForAI(effectiveSlug);
    
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

/**
 * Lista personalidades disponíveis (para comandos)
 */
export async function getAvailablePersonalities() {
    const list = await personalityService.listAll();
    return list.map(p => ({
        id: p.slug,
        slug: p.slug,
        name: p.name,
        emoji: p.emoji,
        description: p.description
    }));
}

/**
 * Define a personalidade do chat (por canal)
 */
export async function setChatPersonality(channelId, personalityId, guildId = null) {
    return chatService.setPersonality(channelId, personalityId, guildId || 'DM');
}

/**
 * Obtém a personalidade atual do chat
 */
export async function getChatPersonality(channelId, guildId = null) {
    return chatService.getChatPersonality(channelId, guildId || 'DM');
}

// Export everything
export default {
    generateResponse,
    getAvailablePersonalities,
    getChannelMood,
    setChannelMood,
    setChatPersonality,
    getChatPersonality,
    clearContext,
    moodEngine
};
