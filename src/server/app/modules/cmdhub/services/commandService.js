/**
 * cmdhub - Command Service
 * CRUD operations for commands + Discord API sync
 */

import { REST, Routes } from 'discord.js';
import Command from '../models/Command.js';
import { builtInCommandOptionsForDeploy as customBuiltIn } from '../../nexus/commands/customCommands.js';
import { builtInCommandOptionsForDeploy as routineBuiltIn } from '../../nexus/commands/routineCommands.js';
import redis from '../../../../database/redis/index.js';
import logger from '../../nexus/utils/logger.js';
import rateLimiter from './rateLimiter.js';

// Redis cache keys
const CACHE_PREFIX = 'cmdhub:commands:';
const CACHE_TTL = 300; // 5 minutes

// Exclude soft-deleted commands from all reads
const notDeleted = { deletedAt: null };

// Discord REST client and config
let rest = null;
let applicationId = null;

function getBuiltInCommandOptions(commandName) {
    const name = (commandName || '').toLowerCase();
    return customBuiltIn[name] ?? routineBuiltIn[name] ?? null;
}

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
        
        // Build query (exclude soft-deleted)
        const query = { ...notDeleted };
        if (filters.category) query.category = filters.category;
        if (filters.enabled !== undefined) query.enabled = filters.enabled;
        if (filters.guildId !== undefined) query.guildId = filters.guildId === 'global' || filters.guildId === '' ? null : filters.guildId;
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
 * Get soft-deleted commands (same filters as getAllCommands)
 */
export async function getDeletedCommands(filters = {}) {
    try {
        const query = { deletedAt: { $ne: null } };
        if (filters.category) query.category = filters.category;
        if (filters.enabled !== undefined) query.enabled = filters.enabled;
        if (filters.guildId !== undefined) query.guildId = filters.guildId === 'global' || filters.guildId === '' ? null : filters.guildId;
        if (filters.status) query['deployment.status'] = filters.status;
        return await Command.find(query).lean();
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao buscar comandos excluídos', error.message);
        throw error;
    }
}

/**
 * Get command by name and scope (guildId = null para global)
 */
export async function getCommandByName(name, guildId = null) {
    const normalizedGuild = guildId === undefined || guildId === '' || guildId === 'global' ? null : guildId;
    const cacheKey = `${CACHE_PREFIX}name:${name}:guild:${normalizedGuild ?? 'global'}`;
    
    try {
        const cached = await redis.get(cacheKey);
        if (cached) {
            return JSON.parse(cached);
        }
        
        const command = await Command.findOne({ name: name.toLowerCase(), guildId: normalizedGuild, ...notDeleted }).lean();
        
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
        return await Command.findOne({ _id: id, ...notDeleted }).lean();
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
        const guildId = data.guildId === '' || data.guildId === 'global' ? null : data.guildId || null;
        const existing = await Command.findOne({ name: data.name.toLowerCase(), guildId, ...notDeleted });
        if (existing) {
            throw new Error(`Comando já existe neste escopo: ${data.name}`);
        }
        const command = new Command({
            ...data,
            name: data.name.toLowerCase(),
            guildId,
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
export async function updateCommand(name, data, updatedBy = 'system', guildId = null) {
    const normalizedGuild = guildId === undefined || guildId === '' || guildId === 'global' ? null : guildId;
    const rateCheck = await rateLimiter.checkRateLimit('update', name);
    if (!rateCheck.allowed) {
        throw new Error(rateCheck.message);
    }
    
    try {
        const command = await Command.findOne({ name: name.toLowerCase(), guildId: normalizedGuild, ...notDeleted });
        
        if (!command) {
            throw new Error(`Comando não encontrado: ${name}`);
        }
        
        if (data.guildId !== undefined) data.guildId = data.guildId === '' || data.guildId === 'global' ? null : data.guildId;
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
 * Delete command (soft delete: sets deletedAt)
 */
export async function deleteCommand(name, guildId = null) {
    try {
        const normalizedGuild = guildId === undefined || guildId === '' || guildId === 'global' ? null : guildId;
        const command = await Command.findOne({ name: name.toLowerCase(), guildId: normalizedGuild, ...notDeleted });
        
        if (!command) {
            throw new Error(`Comando não encontrado: ${name}`);
        }
        
        command.deletedAt = new Date();
        await command.save();
        await invalidateCache();
        
        logger.info('CMDHUB', `🗑️ Comando deletado (soft): ${name}`);
        return command;
    } catch (error) {
        logger.error('CMDHUB', `Erro ao deletar comando: ${name}`, error.message);
        throw error;
    }
}

/**
 * Restore soft-deleted command. If it was also removed from Discord (discord.id null), redeploys to Discord.
 */
export async function restoreCommand(name, guildId = null) {
    const normalizedGuild = guildId === undefined || guildId === '' || guildId === 'global' ? null : guildId;
    const command = await Command.findOne({
        name: name.toLowerCase(),
        guildId: normalizedGuild,
        deletedAt: { $ne: null }
    });
    if (!command) {
        throw new Error(`Comando excluído não encontrado: ${name}`);
    }
    command.deletedAt = null;
    command.deployment.status = 'pending';
    await command.save();
    await invalidateCache();
    logger.info('CMDHUB', `♻️ Comando restaurado: ${name}`);
    const needsDiscord = !command.discord?.id;
    if (needsDiscord && rest && applicationId) {
        try {
            await deployToDiscord(null, normalizedGuild);
            return { command, deployedToDiscord: true };
        } catch (err) {
            logger.warn('CMDHUB', `Restore: comando ${name} restaurado no DB; deploy Discord falhou: ${err.message}`);
            return { command, deployedToDiscord: false, deployError: err.message };
        }
    }
    return { command, deployedToDiscord: false };
}

/**
 * Toggle command enabled/disabled
 */
export async function toggleCommand(name, enabled, guildId = null) {
    try {
        const normalizedGuild = guildId === undefined || guildId === '' || guildId === 'global' ? null : guildId;
        const command = await Command.findOneAndUpdate(
            { name: name.toLowerCase(), guildId: normalizedGuild, ...notDeleted },
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
        
        const route = guildId
            ? Routes.applicationGuildCommands(targetAppId, guildId)
            : Routes.applicationCommands(targetAppId);
        const discordCommands = await rest.get(route);
        const normalizedGuild = guildId === undefined || guildId === '' ? null : guildId;
        const synced = [];
        const onlyOnDiscord = []; // Existe no Discord mas não no nosso Mongo (ou foi deletado aqui) — fonte da verdade é o Mongo

        for (const dc of discordCommands) {
            const command = await Command.findOne({ name: dc.name, guildId: normalizedGuild });
            if (command && !command.deletedAt) {
                command.syncFromDiscord(dc);
                await command.save();
                synced.push(command.name);
            } else {
                onlyOnDiscord.push({
                    id: dc.id,
                    name: dc.name,
                    description: dc.description || ''
                });
                logger.info('CMDHUB', `⚠️ No Discord mas não no Mongo (ignorado no sync): ${dc.name}`);
            }
        }

        await rateLimiter.incrementRateLimit('sync', applicationId);
        await invalidateCache();

        logger.info('CMDHUB', `✅ ${synced.length} sincronizados, ${onlyOnDiscord.length} só no Discord`);
        return { synced, count: synced.length, onlyOnDiscord };
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
        
        const normalizedGuild = guildId === undefined || guildId === '' ? null : guildId;
        const scopeLabel = normalizedGuild ? `guild ${normalizedGuild}` : 'global';
        const route = normalizedGuild
            ? Routes.applicationGuildCommands(targetAppId, normalizedGuild)
            : Routes.applicationCommands(targetAppId);

        // Mongo é a fonte da verdade: comandos que estão no Discord mas não no Mongo devem ser removidos
        const ourCommands = await Command.find({ ...notDeleted, enabled: true, guildId: normalizedGuild });
        const ourNames = new Set(ourCommands.map(c => c.name));
        let discordCommands = [];
        try {
            discordCommands = await rest.get(route);
        } catch (e) {
            logger.debug('CMDHUB', 'Nenhum comando no Discord ainda');
        }
        for (const dc of discordCommands) {
            if (!ourNames.has(dc.name)) {
                try {
                    const deleteRoute = normalizedGuild
                        ? Routes.applicationGuildCommand(targetAppId, normalizedGuild, dc.id)
                        : Routes.applicationCommand(targetAppId, dc.id);
                    await rest.delete(deleteRoute);
                    logger.info('CMDHUB', `🗑️ Removido do Discord (não está no Mongo): ${dc.name}`);
                } catch (err) {
                    logger.warn('CMDHUB', `Ignorando remoção de ${dc.name} no Discord: ${err.message}`);
                }
            }
        }

        // Remover do Discord os desabilitados deste escopo (existem no Mongo mas enabled=false)
        const disabled = await Command.find({
            ...notDeleted,
            enabled: false,
            guildId: normalizedGuild,
            'discord.id': { $exists: true, $ne: null }
        });
        for (const cmd of disabled) {
            try {
                const deleteRoute = normalizedGuild
                    ? Routes.applicationGuildCommand(targetAppId, normalizedGuild, cmd.discord.id)
                    : Routes.applicationCommand(targetAppId, cmd.discord.id);
                await rest.delete(deleteRoute);
                await Command.findOneAndUpdate(
                    { name: cmd.name, guildId: normalizedGuild, ...notDeleted },
                    { 'discord.id': null, 'deployment.status': 'pending' }
                );
                logger.info('CMDHUB', `🗑️ Comando desabilitado removido do Discord (${scopeLabel}): ${cmd.name}`);
            } catch (err) {
                logger.warn('CMDHUB', `Ignorando remoção de ${cmd.name} no Discord: ${err.message}`);
            }
        }
        
        const commandData = ourCommands.map(cmd => {
            const data = cmd.toDiscordAPI();
            const builtInOptions = getBuiltInCommandOptions(cmd.name);
            if (builtInOptions?.length) {
                data.options = builtInOptions;
            }
            return data;
        });
        const result = await rest.put(route, { body: commandData });
        
        for (const deployed of result) {
            await Command.findOneAndUpdate(
                { name: deployed.name, guildId: normalizedGuild, ...notDeleted },
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
        
        logger.info('CMDHUB', `✅ ${result.length} comandos deployados (${scopeLabel})`);
        return { deployed: result.length, commands: result.map(c => c.name), scope: normalizedGuild ? 'guild' : 'global', guildId: normalizedGuild };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao deployar para o Discord', error.message);
        
        await Command.updateMany(
            { ...notDeleted, enabled: true, guildId: normalizedGuild, 'deployment.status': { $ne: 'deployed' } },
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
    
    const normalizedGuild = guildId === undefined || guildId === '' ? null : guildId;
    logger.info('CMDHUB', `deleteFromDiscord: name=${commandName} guildId=${normalizedGuild ?? 'global'}`);
    try {
        const command = await Command.findOne({ name: commandName.toLowerCase(), guildId: normalizedGuild, ...notDeleted });
        
        if (!command) {
            logger.warn('CMDHUB', `deleteFromDiscord: comando não existe no DB: ${commandName} (guildId=${normalizedGuild ?? 'null'})`);
            throw new Error(`Comando não encontrado no Discord: ${commandName}`);
        }
        if (!command?.discord?.id) {
            logger.warn('CMDHUB', `deleteFromDiscord: comando sem discord.id no DB: ${commandName} (nunca deployado?)`);
            throw new Error(`Comando não encontrado no Discord: ${commandName}`);
        }
        
        const route = normalizedGuild
            ? Routes.applicationGuildCommand(applicationId, normalizedGuild, command.discord.id)
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

/**
 * Remove from Discord a command that exists only on Discord (not in our Mongo).
 * Used for "orphan" commands shown after sync.
 */
export async function removeOrphanFromDiscord(applicationId, commandName, guildId = null) {
    if (!rest) {
        throw new Error('Discord REST client não inicializado');
    }
    const normalizedGuild = guildId === undefined || guildId === '' ? null : guildId;
    const route = normalizedGuild
        ? Routes.applicationGuildCommands(applicationId, normalizedGuild)
        : Routes.applicationCommands(applicationId);
    const discordCommands = await rest.get(route);
    const dc = discordCommands.find(c => c.name === commandName);
    if (!dc) {
        throw new Error(`Comando não encontrado no Discord: ${commandName}`);
    }
    const deleteRoute = normalizedGuild
        ? Routes.applicationGuildCommand(applicationId, normalizedGuild, dc.id)
        : Routes.applicationCommand(applicationId, dc.id);
    await rest.delete(deleteRoute);
    logger.info('CMDHUB', `🗑️ Órfão removido do Discord: ${commandName}`);
    return { deleted: commandName };
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
            Command.countDocuments(notDeleted),
            Command.countDocuments({ ...notDeleted, enabled: true }),
            Command.countDocuments({ ...notDeleted, 'deployment.status': 'deployed' }),
            Command.countDocuments({ ...notDeleted, 'deployment.status': 'pending' }),
            Command.countDocuments({ ...notDeleted, 'deployment.status': 'failed' }),
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
        const command = await Command.findOne({ name: commandName.toLowerCase(), ...notDeleted });
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
    getDeletedCommands,
    getCommandByName,
    getCommandById,
    createCommand,
    updateCommand,
    deleteCommand,
    restoreCommand,
    toggleCommand,
    syncFromDiscord,
    deployToDiscord,
    deleteFromDiscord,
    removeOrphanFromDiscord,
    getStats,
    recordUsage
};
