/**
 * cmdhub - Routes
 * HTTP routes for command management API, routines (Life-Sync) e settings.
 */

import commandController from '../controllers/commandController.js';
import * as routineController from '../controllers/routineController.js';
import * as settingsController from '../controllers/settingsController.js';
import logger from '../../nexus/utils/logger.js';

async function commandRoutes(fastify, options) {
    // ═══════════════════════════════════════════════════════════
    // SETTINGS – por usuário, sistema (com acesso), admin (só admin)
    // ═══════════════════════════════════════════════════════════
    fastify.get('/settings/options', settingsController.getSettingsOptions);
    fastify.get('/settings/discord/guilds', settingsController.getDiscordGuilds);
    fastify.get('/settings/discord/guild-members', settingsController.getDiscordGuildMembers);
    fastify.get('/user-preferences/:userId', settingsController.getUserPreferences);
    fastify.put('/user-preferences/:userId', settingsController.putUserPreferences);
    fastify.get('/settings/server', settingsController.getServerConfig);
    fastify.put('/settings/server', settingsController.putServerConfig);
    fastify.get('/settings/admin', settingsController.getAdminConfig);
    fastify.patch('/settings/admin', settingsController.patchAdminConfig);

    // ═══════════════════════════════════════════════════════════
    // ROUTINES (Life-Sync) – apagar, editar, schedule EventBridge
    // ═══════════════════════════════════════════════════════════
    fastify.delete('/routines/:id', routineController.deleteRoutine);
    fastify.get('/routines/:id/delete', routineController.getDeleteRoutine);
    fastify.get('/routines/:id/edit', routineController.getEditRoutine);
    fastify.post('/routines/:id/edit', routineController.postEditRoutine);
    fastify.post('/routines/:id/leave', routineController.postLeaveRoutine);
    fastify.get('/routines/:id/leave', routineController.getLeaveRoutine);

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
    
    // POST /commands/:name/restore - Restore soft-deleted command (and deploy to Discord if needed)
    fastify.post('/commands/:name/restore', commandController.restoreCommand);
    
    // DELETE /commands/:name - Delete command (soft delete in DB)
    fastify.delete('/commands/:name', commandController.deleteCommand);
    
    // POST /commands/sync - Sync commands FROM Discord API
    fastify.post('/commands/sync', commandController.syncFromDiscord);
    
    // POST /commands/deploy - Deploy commands TO Discord API
    fastify.post('/commands/deploy', commandController.deployToDiscord);
    
    // POST /commands/remove-orphan-from-discord - Remove from Discord a command not in Mongo (body: { name, guildId? })
    fastify.post('/commands/remove-orphan-from-discord', commandController.removeOrphanFromDiscord);
    
    // Log registered routes
    logger.info('CMDHUB', '📡 Rotas HTTP registradas:');
    logger.info('CMDHUB', '   GET    /settings/options');
    logger.info('CMDHUB', '   GET/PUT /user-preferences/:userId');
    logger.info('CMDHUB', '   GET/PUT /settings/server');
    logger.info('CMDHUB', '   GET/PATCH /settings/admin');
    logger.info('CMDHUB', '   DELETE /routines/:id');
    logger.info('CMDHUB', '   GET    /routines/:id/delete');
    logger.info('CMDHUB', '   GET    /routines/:id/edit');
    logger.info('CMDHUB', '   POST   /routines/:id/edit');
    logger.info('CMDHUB', '   POST   /routines/:id/leave');
    logger.info('CMDHUB', '   GET    /routines/:id/leave');
    logger.info('CMDHUB', '   GET    /commands');
    logger.info('CMDHUB', '   GET    /commands/stats');
    logger.info('CMDHUB', '   GET    /commands/rate-limit');
    logger.info('CMDHUB', '   GET    /commands/:name');
    logger.info('CMDHUB', '   POST   /commands');
    logger.info('CMDHUB', '   PUT    /commands/:name');
    logger.info('CMDHUB', '   POST   /commands/:name/restore');
    logger.info('CMDHUB', '   DELETE /commands/:name');
    logger.info('CMDHUB', '   PATCH  /commands/:name/toggle');
    logger.info('CMDHUB', '   POST   /commands/sync');
    logger.info('CMDHUB', '   POST   /commands/deploy');
    logger.info('CMDHUB', '   DELETE /commands/:name/discord');
}

export default commandRoutes;
