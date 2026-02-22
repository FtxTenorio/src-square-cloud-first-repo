/**
 * cmdhub - Routes
 * HTTP routes for command management API
 */

import commandController from '../controllers/commandController.js';
import logger from '../../nexus/utils/logger.js';

async function commandRoutes(fastify, options) {
    // ═══════════════════════════════════════════════════════════
    // CRUD ROUTES
    // ═══════════════════════════════════════════════════════════
    
    // GET /commands - List all commands
    fastify.get('/commands', commandController.listCommands);
    
    // GET /commands/stats - Get statistics (before :name to avoid conflict)
    fastify.get('/commands/stats', commandController.getStats);
    
    // GET /commands/rate-limit - Get rate limit status
    fastify.get('/commands/rate-limit', commandController.getRateLimitStatus);
    
    // GET /commands/:name - Get command by name
    fastify.get('/commands/:name', commandController.getCommand);
    
    // POST /commands - Create new command
    fastify.post('/commands', commandController.createCommand);
    
    // PUT /commands/:name - Update command
    fastify.put('/commands/:name', commandController.updateCommand);
    
    // PATCH /commands/:name/toggle - Toggle command enabled/disabled
    fastify.patch('/commands/:name/toggle', commandController.toggleCommand);
    
    // ═══════════════════════════════════════════════════════════
    // DISCORD SYNC ROUTES (more specific paths before /commands/:name)
    // ═══════════════════════════════════════════════════════════
    
    // DELETE /commands/:name/discord - Delete command from Discord (must be before DELETE /commands/:name)
    fastify.delete('/commands/:name/discord', commandController.deleteFromDiscord);
    
    // DELETE /commands/:name - Delete command (soft delete in DB)
    fastify.delete('/commands/:name', commandController.deleteCommand);
    
    // POST /commands/sync - Sync commands FROM Discord API
    fastify.post('/commands/sync', commandController.syncFromDiscord);
    
    // POST /commands/deploy - Deploy commands TO Discord API
    fastify.post('/commands/deploy', commandController.deployToDiscord);
    
    // Log registered routes
    logger.info('CMDHUB', '📡 Rotas HTTP registradas:');
    logger.info('CMDHUB', '   GET    /commands');
    logger.info('CMDHUB', '   GET    /commands/stats');
    logger.info('CMDHUB', '   GET    /commands/rate-limit');
    logger.info('CMDHUB', '   GET    /commands/:name');
    logger.info('CMDHUB', '   POST   /commands');
    logger.info('CMDHUB', '   PUT    /commands/:name');
    logger.info('CMDHUB', '   DELETE /commands/:name');
    logger.info('CMDHUB', '   PATCH  /commands/:name/toggle');
    logger.info('CMDHUB', '   POST   /commands/sync');
    logger.info('CMDHUB', '   POST   /commands/deploy');
    logger.info('CMDHUB', '   DELETE /commands/:name/discord');
}

export default commandRoutes;
