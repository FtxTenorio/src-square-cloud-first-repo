/**
 * cmdhub - Command Hub Module
 * Centralized command management with Discord API sync
 * 
 * Features:
 * - CRUD for slash commands
 * - Sync from/to Discord API
 * - Rate limiting (3 updates/hour per command)
 * - Usage statistics
 * - Redis caching
 */

import commandRoutes from './routes/index.js';
import commandService from './services/commandService.js';
import rateLimiter from './services/rateLimiter.js';
import Command from './models/Command.js';
import logger from '../nexus/utils/logger.js';

/**
 * Initialize cmdhub module
 * @param {string} discordToken - Discord bot token for REST API
 */
export function init(discordToken) {
    if (discordToken) {
        commandService.initRest(discordToken);
    }
    logger.info('CMDHUB', '📦 Módulo cmdhub inicializado');
}

/**
 * Register routes with Fastify
 * @param {FastifyInstance} fastify 
 */
export function registerRoutes(fastify) {
    fastify.register(commandRoutes);
}

// Export everything
export {
    commandService,
    commandRoutes,
    rateLimiter,
    Command
};

export default {
    init,
    registerRoutes,
    commandService,
    rateLimiter,
    Command
};
