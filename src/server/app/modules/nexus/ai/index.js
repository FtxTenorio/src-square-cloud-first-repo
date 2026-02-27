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
import AppConfig from '../../cmdhub/models/AppConfig.js';
import ServerConfig from '../../cmdhub/models/ServerConfig.js';
import { DM_ROUTINE_TOOLS, executeDmRoutineTool } from './tools/dmRoutineTools.js';
import * as userPreferenceService from '../../events/services/userPreferenceService.js';

const AI_CONFIG_DEFAULTS = { model: 'gpt-4o-mini', maxTokens: 500, temperature: 0.8 };

/**
 * Carrega config de OpenAI: por guild (ServerConfig) sobrescreve global (AppConfig).
 * @param {string|null} guildId - Guild do canal; se null usa só AppConfig.
 * @returns {Promise<{ model, maxTokens, temperature }>}
 */
async function getOpenAIConfig(guildId) {
    const out = { ...AI_CONFIG_DEFAULTS };
    let app = await AppConfig.findOne({ _id: 'app' }).lean();
    if (app) {
        if (app.aiModel) out.model = app.aiModel;
        if (app.aiMaxTokens != null) out.maxTokens = app.aiMaxTokens;
        if (app.aiTemperature != null) out.temperature = app.aiTemperature;
    }
    if (guildId) {
        const server = await ServerConfig.findOne({ guildId }).lean();
        if (server) {
            if (server.aiModel != null && server.aiModel !== '') out.model = server.aiModel;
            if (server.aiMaxTokens != null) out.maxTokens = server.aiMaxTokens;
            if (server.aiTemperature != null) out.temperature = server.aiTemperature;
        }
    }
    return out;
}

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
 * Orquestra personalidade do chat e provedores de IA (sem mood automático nem pattern matching).
 * Returns { content }.
 */
export async function generateResponse(message, history = [], options = {}) {
    const userId = message.author?.id || message.userId || 'unknown';
    const channelId = message.channel?.id || message.channelId || 'unknown';
    const guildId = message.guild?.id || message.guildId || null;
    const content = (message.content || '').trim();
    const contentLower = content.toLowerCase();
    
    // Personalidade do chat (sem mood automático)
    const chatPersonality = await chatService.getChatPersonality(channelId, guildId || 'DM');
    let personality = await personalityService.getForAI(chatPersonality?.slug || 'friendly');

    // Forçar modo analista em DMs, independentemente da personalidade do canal
    const isDM = guildId == null;
    if (isDM) {
        personality = await personalityService.getForAI('analista');
    }

    // Update context
    updateContext(userId, channelId, content);
    
    // 2. Try OpenAI if configured (model/tokens/temperature vêm de AppConfig + ServerConfig por guildId)
    if (openai.isConfigured()) {
        try {
            let aiConfig = await getOpenAIConfig(guildId);

            // Overrides por usuário em DM (admin.dm* nas preferências)
            if (isDM) {
                try {
                    const prefs = await userPreferenceService.getPreferences(userId);
                    const admin = prefs?.admin || {};
                    if (admin.dmModel) aiConfig.model = admin.dmModel;
                    if (admin.dmMaxTokens != null) aiConfig.maxTokens = admin.dmMaxTokens;
                    if (admin.dmTemperature != null) aiConfig.temperature = admin.dmTemperature;
                } catch (e) {
                    logger.warn('AI', `Erro ao carregar prefs admin.dm* para ${userId}: ${e.message}`);
                }
            }

            const baseOptions = {
                currentUsername: message.author?.username,
                model: aiConfig.model,
                maxTokens: aiConfig.maxTokens,
                temperature: aiConfig.temperature
            };

            // DM: habilitar funções (tools) para a IA ler e editar rotinas do usuário
            if (isDM) {
                const result = await openai.generateResponseWithTools(content, personality, history, {
                    ...baseOptions,
                    userId,
                    tools: DM_ROUTINE_TOOLS,
                    executeTool: executeDmRoutineTool,
                    messageContext: { message: options.discordMessage, saveToolInfo: options.saveToolInfo }
                });
                return { content: result.content };
            }

            const result = await openai.generateResponse(content, personality, history, baseOptions);
            return { content: result.content };
        } catch (error) {
            logger.ai.error(error);
            return { content: getSleepingMessage() };
        }
    }
    
    // 3. Fallback - Frieren está dormindo
    return { content: getSleepingMessage() };
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
