/**
 * Server Service
 * Gerencia informações de servidores Discord (guilds).
 */

import Server from '../../../models/Server.js';
import logger from '../utils/logger.js';

/**
 * Encontra ou cria um servidor
 * @param {string} guildId
 * @param {object} data - { name, memberCount?, iconUrl? }
 * @returns {Promise<object>}
 */
export async function findOrCreate(guildId, data = {}) {
    let server = await Server.findOne({ guildId }).lean();
    if (server) {
        if (data.name && data.name !== server.name) {
            await Server.updateOne({ guildId }, { $set: { name: data.name, ...data } });
            server = await Server.findOne({ guildId }).lean();
        }
        return server;
    }
    server = await Server.create({
        guildId,
        name: data.name || `Servidor ${guildId}`,
        memberCount: data.memberCount ?? null,
        iconUrl: data.iconUrl ?? null
    });
    logger.debug('SERVER', `Servidor criado: ${guildId}`);
    return server.toObject();
}

/**
 * Busca servidor por guildId
 * @param {string} guildId
 */
export async function getByGuildId(guildId) {
    return Server.findOne({ guildId }).lean();
}

export default {
    findOrCreate,
    getByGuildId
};
