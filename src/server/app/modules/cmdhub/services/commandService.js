/**
 * cmdhub - Command Service
 * CRUD operations for commands + Discord API sync
 */

import { REST, Routes } from 'discord.js';
import Command from '../models/Command.js';
import redis from '../../redis/index.js';
import logger from '../../nexus/utils/logger.js';
import rateLimiter from './rateLimiter.js';

// Redis cache keys
const CACHE_PREFIX = 'cmdhub:commands:';
const CACHE_TTL = 300; // 5 minutes

// Discord REST client and config
let rest = null;
let applicationId = null;

/**
 * Initialize Discord REST client
 */
export function initRest(token, appId = null) {
    rest = new REST({ version: '10' }).setToken(token);
    applicationId = appId || process.env.DISCORD_APPLICATION_ID;
    logger.info('CMDHUB', '🔌 Discord REST client inicializado');
}

/**
 * Set application ID (can be set later from bot client)
 */
export function setApplicationId(appId) {
    applicationId = appId;
    logger.debug('CMDHUB', `📋 Application ID configurado: ${appId}`);
}

/**
 * Get current application ID
 */
export function getApplicationId() {
    return applicationId;
}

// ═══════════════════════════════════════════════════════════
// CRUD OPERATIONS
// ═══════════════════════════════════════════════════════════

/**
 * Get all commands (with optional filters)
 */
export async function getAllCommands(filters = {}) {
    const cacheKey = `${CACHE_PREFIX}all:${JSON.stringify(filters)}`;
    
    try {
        // Try cache first
        const cached = await redis.get(cacheKey);
        if (cached) {
            logger.debug('CMDHUB', '📦 Cache HIT: getAllCommands');
            return JSON.parse(cached);
        }
        
        // Build query
        const query = {};
        if (filters.category) query.category = filters.category;
        if (filters.enabled !== undefined) query.enabled = filters.enabled;
        if (filters.guildId) query.guildId = filters.guildId;
        if (filters.status) query['deployment.status'] = filters.status;
        
        const commands = await Command.find(query).lean();
        
        // Cache result
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(commands));
        
        return commands;
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao buscar comandos', error.message);
        throw error;
    }
}

/**
 * Get command by name
 */
export async function getCommandByName(name) {
    const cacheKey = `${CACHE_PREFIX}name:${name}`;
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        
        const command = await Command.findOne({ name: name.toLowerCase() }).lean();
        
        if (command) {
            await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(command));
        }
        
        return command;
    } catch (error) {
        logger.error('CMDHUB', `Erro ao buscar comando: ${name}`, error.message);
        throw error;
    }
}

/**
 * Get command by ID
 */
export async function getCommandById(id) {
    try {
        return await Command.findById(id).lean();
    } catch (error) {
        logger.error('CMDHUB', `Erro ao buscar comando por ID: ${id}`, error.message);
        throw error;
    }
}

/**
 * Create new command
 */
export async function createCommand(data, createdBy = 'system') {
    try {
        const command = new Command({
            ...data,
            name: data.name.toLowerCase(),
            createdBy,
            updatedBy: createdBy
        });
        
        await command.save();
        await invalidateCache();
        
        logger.info('CMDHUB', `✅ Comando criado: ${command.name}`);
        return command;
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao criar comando', error.message);
        throw error;
    }
}

/**
 * Update command
 */
export async function updateCommand(name, data, updatedBy = 'system') {
    // Check rate limit
    const rateCheck = await rateLimiter.checkRateLimit('update', name);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }
    
    try {
        const command = await Command.findOne({ name: name.toLowerCase() });
        
        if (!command) {
            throw new Error(`Comando não encontrado: ${name}`);
        }
        
        // Update fields
        Object.assign(command, data);
        command.updatedBy = updatedBy;
        command.version += 1;
        command.deployment.status = 'outdated';
        
        await command.save();
        await rateLimiter.incrementRateLimit('update', name);
        await invalidateCache();
        
        logger.info('CMDHUB', `📝 Comando atualizado: ${name} (v${command.version})`);
        return command;
    } catch (error) {
        logger.error('CMDHUB', `Erro ao atualizar comando: ${name}`, error.message);
        throw error;
    }
}

/**
 * Delete command
 */
export async function deleteCommand(name) {
    try {
        const command = await Command.findOneAndDelete({ name: name.toLowerCase() });
        
        if (!command) {
            throw new Error(`Comando não encontrado: ${name}`);
        }
        
        await invalidateCache();
        
        logger.info('CMDHUB', `🗑️ Comando deletado: ${name}`);
        return command;
    } catch (error) {
        logger.error('CMDHUB', `Erro ao deletar comando: ${name}`, error.message);
        throw error;
    }
}

/**
 * Toggle command enabled/disabled
 */
export async function toggleCommand(name, enabled) {
    try {
        const command = await Command.findOneAndUpdate(
            { name: name.toLowerCase() },
            { enabled, 'deployment.status': 'outdated' },
            { new: true }
        );
        
        if (!command) {
            throw new Error(`Comando não encontrado: ${name}`);
        }
        
        await invalidateCache();
        
        logger.info('CMDHUB', `🔄 Comando ${enabled ? 'ativado' : 'desativado'}: ${name}`);
        return command;
    } catch (error) {
        logger.error('CMDHUB', `Erro ao alternar comando: ${name}`, error.message);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
// DISCORD API SYNC
// ═══════════════════════════════════════════════════════════

/**
 * Fetch commands directly from Discord API (live, not from DB)
 * This is useful to see what's actually registered on Discord
 */
export async function getCommandsFromDiscord(guildId = null) {
    if (!rest) {
        throw new Error('Discord REST client não inicializado');
    }
    
    if (!applicationId) {
        throw new Error('Application ID não configurado');
    }
    
    try {
        logger.info('CMDHUB', '📡 Buscando comandos do Discord API...');
        
        // Fetch from Discord API
        const route = guildId 
            ? Routes.applicationGuildCommands(applicationId, guildId)
            : Routes.applicationCommands(applicationId);
            
        const discordCommands = await rest.get(route);
        
        logger.info('CMDHUB', `✅ ${discordCommands.length} comandos encontrados no Discord`);
        
        // Transform to a cleaner format
        return discordCommands.map(cmd => ({
            id: cmd.id,
            name: cmd.name,
            description: cmd.description,
            type: cmd.type,
            options: cmd.options || [],
            applicationId: cmd.application_id,
            version: cmd.version,
            nsfw: cmd.nsfw || false,
            dmPermission: cmd.dm_permission,
            defaultMemberPermissions: cmd.default_member_permissions,
            integrationTypes: cmd.integration_types || [],
            contexts: cmd.contexts || [],
            guildId: guildId || null
        }));
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao buscar comandos do Discord', error.message);
        throw error;
    }
}

/**
 * Fetch commands from Discord API and sync to DB
 */
export async function syncFromDiscord(appId = null, guildId = null) {
    if (!rest) {
        throw new Error('Discord REST client não inicializado');
    }
    
    const targetAppId = appId || applicationId;
    if (!targetAppId) {
        throw new Error('Application ID não configurado');
    }
    
    // Check rate limit
    const rateCheck = await rateLimiter.checkRateLimit('sync', targetAppId);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }
    
    try {
        logger.info('CMDHUB', '🔄 Sincronizando comandos do Discord...');
        
        // Fetch from Discord API
        const route = guildId 
            ? Routes.applicationGuildCommands(targetAppId, guildId)
            : Routes.applicationCommands(targetAppId);
            
        const discordCommands = await rest.get(route);
        
        // Sync each command
        const synced = [];
        for (const dc of discordCommands) {
            let command = await Command.findOne({ name: dc.name });
            
            if (command) {
                // Update existing
                command.syncFromDiscord(dc);
            } else {
                // Create new from Discord
                command = new Command({
                    name: dc.name,
                    description: dc.description,
                    options: dc.options || [],
                    guildId: guildId,
                    category: 'custom'
                });
                command.syncFromDiscord(dc);
            }
            
            await command.save();
            synced.push(command.name);
        }
        
        await rateLimiter.incrementRateLimit('sync', applicationId);
        await invalidateCache();
        
        logger.info('CMDHUB', `✅ ${synced.length} comandos sincronizados`);
        return { synced, count: synced.length };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao sincronizar do Discord', error.message);
        throw error;
    }
}

/**
 * Deploy commands to Discord API
 */
export async function deployToDiscord(appId = null, guildId = null) {
    if (!rest) {
        throw new Error('Discord REST client não inicializado');
    }
    
    const targetAppId = appId || applicationId;
    if (!targetAppId) {
        throw new Error('Application ID não configurado');
    }
    
    // Check rate limit
    const rateCheck = await rateLimiter.checkRateLimit('deploy', targetAppId);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }
    
    try {
        logger.info('CMDHUB', '🚀 Deployando comandos para o Discord...');
        
        // Get enabled commands
        const commands = await Command.find({ enabled: true });
        const commandData = commands.map(cmd => cmd.toDiscordAPI());
        
        // Deploy to Discord
        const route = guildId 
            ? Routes.applicationGuildCommands(targetAppId, guildId)
            : Routes.applicationCommands(targetAppId);
            
        const result = await rest.put(route, { body: commandData });
        
        // Update deployment status
        for (const deployed of result) {
            await Command.findOneAndUpdate(
                { name: deployed.name },
                {
                    'discord.id': deployed.id,
                    'discord.applicationId': deployed.application_id,
                    'discord.version': deployed.version,
                    'deployment.status': 'deployed',
                    'deployment.lastDeployed': new Date(),
                    $inc: { 'deployment.deployCount': 1 }
                }
            );
        }
        
        await rateLimiter.incrementRateLimit('deploy', targetAppId);
        await invalidateCache();
        
        logger.info('CMDHUB', `✅ ${result.length} comandos deployados`);
        return { deployed: result.length, commands: result.map(c => c.name) };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao deployar para o Discord', error.message);
        
        // Mark failed
        await Command.updateMany(
            { enabled: true, 'deployment.status': { $ne: 'deployed' } },
            { 
                'deployment.status': 'failed',
                'deployment.lastError': error.message
            }
        );
        
        throw error;
    }
}

/**
 * Delete command from Discord API
 */
export async function deleteFromDiscord(applicationId, commandName, guildId = null) {
    if (!rest) {
        throw new Error('Discord REST client não inicializado');
    }
    
    try {
        const command = await Command.findOne({ name: commandName.toLowerCase() });
        
        if (!command?.discord?.id) {
            throw new Error(`Comando não encontrado no Discord: ${commandName}`);
        }
        
        const route = guildId
            ? Routes.applicationGuildCommand(applicationId, guildId, command.discord.id)
            : Routes.applicationCommand(applicationId, command.discord.id);
            
        await rest.delete(route);
        
        // Update local
        command.discord.id = null;
        command.deployment.status = 'pending';
        await command.save();
        
        await invalidateCache();
        
        logger.info('CMDHUB', `🗑️ Comando removido do Discord: ${commandName}`);
        return { deleted: commandName };
    } catch (error) {
        logger.error('CMDHUB', `Erro ao deletar do Discord: ${commandName}`, error.message);
        throw error;
    }
}

// ═══════════════════════════════════════════════════════════
// STATISTICS
// ═══════════════════════════════════════════════════════════

/**
 * Get command statistics
 */
export async function getStats() {
    try {
        const [
            total,
            enabled,
            deployed,
            pending,
            failed,
            topCommands
        ] = await Promise.all([
            Command.countDocuments(),
            Command.countDocuments({ enabled: true }),
            Command.countDocuments({ 'deployment.status': 'deployed' }),
            Command.countDocuments({ 'deployment.status': 'pending' }),
            Command.countDocuments({ 'deployment.status': 'failed' }),
            Command.getTopCommands(5)
        ]);
        
        const rateLimitStats = await rateLimiter.getRateLimitStats();
        
        return {
            total,
            enabled,
            disabled: total - enabled,
            deployment: { deployed, pending, failed },
            topCommands: topCommands.map(c => ({
                name: c.name,
                uses: c.stats?.totalUses || 0
            })),
            rateLimit: rateLimitStats
        };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao obter estatísticas', error.message);
        throw error;
    }
}

/**
 * Record command usage
 */
export async function recordUsage(commandName, guildId = null) {
    try {
        const command = await Command.findOne({ name: commandName.toLowerCase() });
        if (command) {
            await command.recordUsage(guildId);
        }
    } catch (error) {
        logger.debug('CMDHUB', `Erro ao registrar uso: ${commandName}`);
    }
}

// ═══════════════════════════════════════════════════════════
// CACHE MANAGEMENT
// ═══════════════════════════════════════════════════════════

/**
 * Invalidate all cmdhub cache
 */
async function invalidateCache() {
    try {
        const keys = await redis.keys(`${CACHE_PREFIX}*`);
        if (keys.length > 0) {
            await redis.del(...keys);
            logger.debug('CMDHUB', `🗑️ Cache invalidado (${keys.length} keys)`);
        }
    } catch (error) {
        logger.debug('CMDHUB', 'Erro ao invalidar cache', error.message);
    }
}

export default {
    initRest,
    setApplicationId,
    getApplicationId,
    getCommandsFromDiscord,
    getAllCommands,
    getCommandByName,
    getCommandById,
    createCommand,
    updateCommand,
    deleteCommand,
    toggleCommand,
    syncFromDiscord,
    deployToDiscord,
    deleteFromDiscord,
    getStats,
    recordUsage
};
