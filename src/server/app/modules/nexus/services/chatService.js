/**
 * Chat Service
 * Gerencia informações de canais (chats). Cada chat pertence a um servidor e tem uma personalidade.
 */

import Chat from '../../../models/Chat.js';
import * as serverService from './serverService.js';
import * as personalityService from './personalityService.js';
import logger from '../utils/logger.js';

const DEFAULT_PERSONALITY_SLUG = 'friendly';

/**
 * Encontra ou cria um chat (canal)
 * Garante que o servidor exista antes
 * @param {string} channelId
 * @param {string} guildId
 * @param {object} options - { name?, personalityId? }
 * @returns {Promise<object>}
 */
export async function findOrCreate(channelId, guildId, options = {}) {
    const guildIdOrDm = guildId || 'DM';
    await serverService.findOrCreate(guildIdOrDm, options.serverData || {});

    let chat = await Chat.findOne({ channelId }).lean();
    if (chat) {
        if (options.personalityId && options.personalityId !== chat.personalityId) {
            await Chat.updateOne(
                { channelId },
                { $set: { personalityId: options.personalityId, name: options.name || chat.name } }
            );
            chat = await Chat.findOne({ channelId }).lean();
        }
        return chat;
    }

    const personalityId = options.personalityId || DEFAULT_PERSONALITY_SLUG;
    chat = await Chat.create({
        channelId,
        guildId: guildIdOrDm,
        name: options.name || '',
        personalityId
    });
    logger.debug('CHAT', `Chat criado: ${channelId} (personality: ${personalityId})`);
    return chat.toObject();
}

/**
 * Busca chat por channelId
 * @param {string} channelId
 */
export async function getByChannelId(channelId) {
    return Chat.findOne({ channelId }).lean();
}

/**
 * Define a personalidade do chat
 * @param {string} channelId
 * @param {string} personalityId - slug ou _id da personalidade
 * @param {string} guildId
 */
export async function setPersonality(channelId, personalityId, guildId = 'DM') {
    const chat = await findOrCreate(channelId, guildId);
    await Chat.updateOne({ channelId }, { $set: { personalityId } });
    logger.info('CHAT', `Personality alterada: canal ${channelId} → ${personalityId}`);
    return Chat.findOne({ channelId }).lean();
}

/**
 * Obtém a personalidade efetiva do chat (objeto completo para IA)
 * @param {string} channelId
 * @param {string} guildId
 * @returns {Promise<object>} personalidade com systemPrompt
 */
export async function getChatPersonality(channelId, guildId = 'DM') {
    const chat = await getByChannelId(channelId);
    const personalityId = chat?.personalityId || DEFAULT_PERSONALITY_SLUG;
    return personalityService.getForAI(personalityId);
}

/**
 * Lista chats de um servidor
 * @param {string} guildId
 */
export async function listByGuild(guildId) {
    return Chat.find({ guildId }).sort({ name: 1 }).lean();
}

export default {
    findOrCreate,
    getByChannelId,
    setPersonality,
    getChatPersonality,
    listByGuild
};
