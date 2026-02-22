/**
 * cmdhub - Command Controller
 * HTTP handlers for command CRUD and Discord sync
 */

import commandService from '../services/commandService.js';
import rateLimiter from '../services/rateLimiter.js';
import logger from '../../nexus/utils/logger.js';

/**
 * GET /commands
 * List all commands with optional filters
 */
export async function listCommands(request, reply) {
    try {
        const { category, enabled, guildId, status, source } = request.query;
        logger.info('CMDHUB', `GET /commands query=${JSON.stringify({ category, enabled, guildId, status, source })}`);
        
        // If source=discord, fetch directly from Discord API
        if (source === 'discord') {
            const commands = await commandService.getCommandsFromDiscord(guildId);
            
            logger.http.request('GET', '/commands?source=discord', 200, 0);
            
            return {
                success: true,
                source: 'discord',
                count: commands.length,
                data: commands
            };
        }
        
        const filters = {};
        if (category) filters.category = category;
        if (enabled !== undefined) filters.enabled = enabled === 'true';
        if (guildId !== undefined) filters.guildId = guildId;
        if (status) filters.status = status;
        
        const commands = await commandService.getAllCommands(filters);
        
        logger.http.request('GET', '/commands', 200, 0);
        
        return {
            success: true,
            source: 'database',
            count: commands.length,
            data: commands
        };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao listar comandos', error.message);
        reply.status(500);
        return { success: false, error: error.message };
    }
}

/**
 * GET /commands/:name
 * Get command by name
 */
export async function getCommand(request, reply) {
    try {
        const { name } = request.params;
        const guildId = request.query.guildId;
        logger.info('CMDHUB', `GET /commands/${name} guildId=${guildId ?? 'null'}`);
        const command = await commandService.getCommandByName(name, guildId);
        
        if (!command) {
            logger.warn('CMDHUB', `Comando não encontrado: ${name} (guildId=${guildId ?? 'null'})`);
            reply.status(404);
            return { success: false, error: `Comando não encontrado: ${name}` };
        }
        
        logger.http.request('GET', `/commands/${name}`, 200, 0);
        
        return { success: true, data: command };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao buscar comando', error.message);
        reply.status(500);
        return { success: false, error: error.message };
    }
}

/**
 * POST /commands
 * Create new command
 */
export async function createCommand(request, reply) {
    try {
        const { name, description, options, category, enabled, guildId, defaultMemberPermissions, dmPermission } = request.body;
        logger.info('CMDHUB', `POST /commands name=${name} guildId=${guildId ?? 'null'} category=${category ?? 'custom'}`);
        
        if (!name || !description) {
            logger.warn('CMDHUB', 'Create command: nome ou descrição ausente');
            reply.status(400);
            return { success: false, error: 'Nome e descrição são obrigatórios' };
        }
        
        const existing = await commandService.getCommandByName(name, guildId);
        if (existing) {
            logger.warn('CMDHUB', `Comando já existe neste escopo: ${name} (guildId=${guildId ?? 'null'})`);
            reply.status(409);
            return { success: false, error: `Comando já existe neste escopo: ${name}` };
        }
        
        const command = await commandService.createCommand({
            name,
            description,
            options: options || [],
            category: category || 'custom',
            enabled: enabled !== false,
            guildId: guildId || null,
            defaultMemberPermissions,
            dmPermission
        }, request.headers['x-user-id'] || 'api');
        
        logger.http.request('POST', '/commands', 201, 0);
        reply.status(201);
        
        return { success: true, data: command };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao criar comando', error.message);
        reply.status(500);
        return { success: false, error: error.message };
    }
}

/**
 * PUT /commands/:name
 * Update command
 */
export async function updateCommand(request, reply) {
    try {
        const { name } = request.params;
        const { guildId, ...updates } = request.body || {};
        logger.info('CMDHUB', `PUT /commands/${name} guildId=${guildId ?? 'null'} keys=${Object.keys(updates).join(',') || 'none'}`);
        
        const rateCheck = await rateLimiter.checkRateLimit('update', name);
        if (!rateCheck.allowed) {
            reply.status(429);
            reply.header('X-RateLimit-Remaining', rateCheck.remaining);
            reply.header('X-RateLimit-Reset', rateCheck.resetIn);
            return { 
                success: false, 
                error: rateCheck.message,
                rateLimit: {
                    remaining: rateCheck.remaining,
                    resetIn: rateCheck.resetIn
                }
            };
        }
        
        const command = await commandService.updateCommand(
            name, 
            updates, 
            request.headers['x-user-id'] || 'api',
            guildId ?? request.query.guildId
        );
        
        reply.header('X-RateLimit-Remaining', rateCheck.remaining - 1);
        logger.http.request('PUT', `/commands/${name}`, 200, 0);
        
        return { success: true, data: command };
    } catch (error) {
        if (error.message.includes('não encontrado')) {
            logger.warn('CMDHUB', `Update: comando não encontrado ${request.params?.name}`);
            reply.status(404);
        } else if (error.message.includes('Rate limit')) {
            logger.warn('CMDHUB', `Update: rate limit ${request.params?.name}`);
            reply.status(429);
        } else {
            logger.error('CMDHUB', `Erro ao atualizar comando ${request.params?.name}`, error.message);
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * DELETE /commands/:name
 * Delete command
 */
export async function deleteCommand(request, reply) {
    try {
        const { name } = request.params;
        const guildId = request.body?.guildId ?? request.query.guildId;
        logger.info('CMDHUB', `DELETE /commands/${name} guildId=${guildId ?? 'null'} (soft delete)`);
        
        await commandService.deleteCommand(name, guildId);
        
        logger.http.request('DELETE', `/commands/${name}`, 200, 0);
        
        return { success: true, message: `Comando deletado: ${name}` };
    } catch (error) {
        if (error.message.includes('não encontrado')) {
            logger.warn('CMDHUB', `Delete: comando não encontrado ${name} (guildId=${request.body?.guildId ?? request.query?.guildId ?? 'null'})`);
            reply.status(404);
        } else {
            logger.error('CMDHUB', `Erro ao deletar comando ${name}`, error.message);
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * PATCH /commands/:name/toggle
 * Toggle command enabled/disabled
 */
export async function toggleCommand(request, reply) {
    try {
        const { name } = request.params;
        const { enabled, guildId } = request.body || {};
        logger.info('CMDHUB', `PATCH /commands/${name}/toggle enabled=${enabled} guildId=${guildId ?? 'null'}`);
        
        if (enabled === undefined) {
            reply.status(400);
            return { success: false, error: 'Campo "enabled" é obrigatório' };
        }
        
        const command = await commandService.toggleCommand(name, enabled, guildId ?? request.query.guildId);
        
        logger.http.request('PATCH', `/commands/${name}/toggle`, 200, 0);
        
        return { success: true, data: command };
    } catch (error) {
        if (error.message.includes('não encontrado')) {
            reply.status(404);
        } else {
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * GET /commands/stats
 * Get command statistics
 */
export async function getStats(request, reply) {
    try {
        const stats = await commandService.getStats();
        
        logger.http.request('GET', '/commands/stats', 200, 0);
        
        return { success: true, data: stats };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao obter stats', error.message);
        reply.status(500);
        return { success: false, error: error.message };
    }
}

/**
 * POST /commands/sync
 * Sync commands from Discord API to MongoDB
 */
export async function syncFromDiscord(request, reply) {
    try {
        const { guildId } = request.body || {};
        logger.info('CMDHUB', `POST /commands/sync guildId=${guildId ?? 'null'}`);
        
        // applicationId is optional - will use the one configured in cmdhub
        const appId = commandService.getApplicationId();
        if (!appId) {
            reply.status(400);
            return { success: false, error: 'Application ID não configurado. Bot ainda não está online?' };
        }
        
        // Check rate limit for sync
        const rateCheck = await rateLimiter.checkRateLimit('sync', appId);
        if (!rateCheck.allowed) {
            reply.status(429);
            return { 
                success: false, 
                error: rateCheck.message,
                rateLimit: {
                    remaining: rateCheck.remaining,
                    resetIn: rateCheck.resetIn
                }
            };
        }
        
        const result = await commandService.syncFromDiscord(null, guildId);
        
        logger.http.request('POST', '/commands/sync', 200, 0);
        
        return { success: true, ...result };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao sincronizar', error.message);
        
        if (error.message.includes('Rate limit')) {
            reply.status(429);
        } else {
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * POST /commands/deploy
 * Deploy commands to Discord API
 */
export async function deployToDiscord(request, reply) {
    try {
        const { guildId } = request.body || {};
        logger.info('CMDHUB', `POST /commands/deploy guildId=${guildId ?? 'null'}`);
        
        const appId = commandService.getApplicationId();
        if (!appId) {
            reply.status(400);
            return { success: false, error: 'Application ID não configurado. Bot ainda não está online?' };
        }
        
        // Check rate limit for deploy
        const rateCheck = await rateLimiter.checkRateLimit('deploy', appId);
        if (!rateCheck.allowed) {
            reply.status(429);
            return { 
                success: false, 
                error: rateCheck.message,
                rateLimit: {
                    remaining: rateCheck.remaining,
                    resetIn: rateCheck.resetIn
                }
            };
        }
        
        const result = await commandService.deployToDiscord(null, guildId);
        
        logger.http.request('POST', '/commands/deploy', 200, 0);
        
        return { success: true, ...result };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao deployar', error.message);
        
        if (error.message.includes('Rate limit')) {
            reply.status(429);
        } else {
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * DELETE /commands/:name/discord
 * Delete command from Discord API
 */
export async function deleteFromDiscord(request, reply) {
    try {
        const { name } = request.params;
        const { guildId } = request.body || {};
        logger.info('CMDHUB', `DELETE /commands/${name}/discord guildId=${guildId ?? 'null'}`);
        
        const appId = commandService.getApplicationId();
        if (!appId) {
            logger.warn('CMDHUB', 'deleteFromDiscord: Application ID não configurado');
            reply.status(400);
            return { success: false, error: 'Application ID não configurado' };
        }
        
        const result = await commandService.deleteFromDiscord(appId, name, guildId);
        
        logger.http.request('DELETE', `/commands/${name}/discord`, 200, 0);
        
        return { success: true, ...result };
    } catch (error) {
        if (error.message.includes('não encontrado')) {
            logger.warn('CMDHUB', `deleteFromDiscord: comando não encontrado ${name} (guildId=${request.body?.guildId ?? 'null'}) - ${error.message}`);
            reply.status(404);
        } else {
            logger.error('CMDHUB', `Erro ao deletar do Discord: ${name}`, error.message);
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * POST /commands/remove-orphan-from-discord
 * Remove from Discord a command that exists only there (not in Mongo). Body: { name, guildId? }
 */
export async function removeOrphanFromDiscord(request, reply) {
    try {
        const { name, guildId } = request.body || {};
        if (!name) {
            reply.status(400);
            return { success: false, error: 'Campo "name" é obrigatório' };
        }
        const appId = commandService.getApplicationId();
        if (!appId) {
            reply.status(400);
            return { success: false, error: 'Application ID não configurado' };
        }
        const result = await commandService.removeOrphanFromDiscord(appId, name, guildId);
        logger.http.request('POST', '/commands/remove-orphan-from-discord', 200, 0);
        return { success: true, ...result };
    } catch (error) {
        if (error.message.includes('não encontrado')) {
            reply.status(404);
        } else {
            reply.status(500);
        }
        return { success: false, error: error.message };
    }
}

/**
 * GET /commands/rate-limit
 * Get rate limit status
 */
export async function getRateLimitStatus(request, reply) {
    try {
        const stats = await rateLimiter.getRateLimitStats();
        
        return {
            success: true,
            maxAttempts: rateLimiter.MAX_ATTEMPTS,
            windowSeconds: rateLimiter.WINDOW_TTL,
            active: stats
        };
    } catch (error) {
        reply.status(500);
        return { success: false, error: error.message };
    }
}

export default {
    listCommands,
    getCommand,
    createCommand,
    updateCommand,
    deleteCommand,
    toggleCommand,
    getStats,
    syncFromDiscord,
    deployToDiscord,
    deleteFromDiscord,
    removeOrphanFromDiscord,
    getRateLimitStatus
};
