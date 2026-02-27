/**
 * cmdhub - Settings Controller
 * User preferences (por usuário), server config (sistema, com acesso), admin config (só admin).
 */

import * as userPreferenceService from '../../events/services/userPreferenceService.js';
import ServerConfig from '../models/ServerConfig.js';
import AppConfig from '../models/AppConfig.js';
import { getConfig } from '../../nexus/core/config.js';
import logger from '../../nexus/utils/logger.js';
import nexus from '../../nexus/index.js';

// ═══════════════════════════════════════════════════════════
// USER PREFERENCES (por usuário — validar acesso por userId no futuro)
// ═══════════════════════════════════════════════════════════

export async function getUserPreferences(request, reply) {
    try {
        const { userId } = request.params;
        if (!userId) {
            reply.status(400);
            return { success: false, error: 'userId é obrigatório' };
        }
        const prefs = await userPreferenceService.getPreferences(userId);
        const base = {
            userId,
            timezone: null,
            admin: {
                dmModel: null,
                dmTemperature: null,
                dmMaxTokens: null
            }
        };
        return { success: true, data: prefs ? { ...base, ...prefs, admin: { ...base.admin, ...(prefs.admin || {}) } } : base };
    } catch (err) {
        logger.error('CMDHUB', 'getUserPreferences', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

export async function putUserPreferences(request, reply) {
    try {
        const { userId } = request.params;
        const body = request.body || {};
        if (!userId) {
            reply.status(400);
            return { success: false, error: 'userId é obrigatório' };
        }
        const { timezone, admin } = body;
        if (timezone !== undefined && timezone !== null) {
            await userPreferenceService.saveTimezone(userId, String(timezone).trim() || null);
        }
        if (admin !== undefined && admin !== null) {
            await userPreferenceService.saveAdminDmAIConfig(userId, admin);
        }
        const prefs = await userPreferenceService.getPreferences(userId);
        const base = {
            userId,
            timezone: null,
            admin: {
                dmModel: null,
                dmTemperature: null,
                dmMaxTokens: null
            }
        };
        return { success: true, data: prefs ? { ...base, ...prefs, admin: { ...base.admin, ...(prefs.admin || {}) } } : base };
    } catch (err) {
        logger.error('CMDHUB', 'putUserPreferences', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// SERVER CONFIG (sistema — requer admin ou validação de acesso ao guild)
// ═══════════════════════════════════════════════════════════

export async function getServerConfig(request, reply) {
    try {
        const guildId = request.query?.guildId || null;
        if (!guildId) {
            reply.status(400);
            return { success: false, error: 'guildId é obrigatório na query' };
        }
        const doc = await ServerConfig.findOne({ guildId }).lean();
        const defaults = {
            guildId,
            modLogChannelId: getConfig('moderation.logChannel') || null,
            xpEnabled: true,
            rateLimitWindowMs: getConfig('rateLimit.commands.windowMs') ?? 60 * 1000,
            rateLimitMax: getConfig('rateLimit.commands.maxRequests') ?? 10,
            timezoneDefault: null,
            locale: null,
            aiModel: null,
            aiTemperature: null,
            aiMaxTokens: null
        };
        return { success: true, data: doc ? { ...defaults, ...doc } : defaults };
    } catch (err) {
        logger.error('CMDHUB', 'getServerConfig', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

export async function putServerConfig(request, reply) {
    try {
        const body = request.body || {};
        const { guildId, modLogChannelId, xpEnabled, rateLimitWindowMs, rateLimitMax, timezoneDefault, locale, aiModel, aiTemperature, aiMaxTokens } = body;
        if (!guildId) {
            reply.status(400);
            return { success: false, error: 'guildId é obrigatório' };
        }
        const update = {};
        if (modLogChannelId !== undefined) update.modLogChannelId = modLogChannelId ? String(modLogChannelId).trim() : null;
        if (xpEnabled !== undefined) update.xpEnabled = Boolean(xpEnabled);
        if (rateLimitWindowMs !== undefined) update.rateLimitWindowMs = Number(rateLimitWindowMs) || 60 * 1000;
        if (rateLimitMax !== undefined) update.rateLimitMax = Number(rateLimitMax) || 10;
        if (timezoneDefault !== undefined) update.timezoneDefault = timezoneDefault ? String(timezoneDefault).trim() : null;
        if (locale !== undefined) update.locale = locale ? String(locale).trim() : null;
        if (aiModel !== undefined) update.aiModel = aiModel ? String(aiModel).trim() : null;
        if (aiTemperature !== undefined) update.aiTemperature = aiTemperature == null ? null : Math.max(0, Math.min(2, Number(aiTemperature) || 0.8));
        if (aiMaxTokens !== undefined) update.aiMaxTokens = aiMaxTokens == null ? null : Math.max(1, Math.min(4096, Number(aiMaxTokens) || 500));

        const doc = await ServerConfig.findOneAndUpdate(
            { guildId },
            { $set: update },
            { new: true, upsert: true }
        ).lean();
        logger.info('CMDHUB', `Server config atualizado: guild ${guildId}`);
        return { success: true, data: doc };
    } catch (err) {
        logger.error('CMDHUB', 'putServerConfig', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// ADMIN CONFIG (somente administradores — sem separação por usuário)
// ═══════════════════════════════════════════════════════════

export async function getAdminConfig(request, reply) {
    try {
        let doc = await AppConfig.findOne({ _id: 'app' }).lean();
        const defaults = {
            aiModel: getConfig('ai.openai.model') || 'gpt-3.5-turbo',
            aiTemperature: getConfig('ai.openai.temperature') ?? 0.8,
            aiMaxTokens: getConfig('ai.openai.maxTokens') ?? 500,
            features: {
                ai: true,
                levels: true,
                moderation: true,
                routines: true
            }
        };
        if (!doc) {
            await AppConfig.create({ _id: 'app', ...defaults });
            doc = await AppConfig.findOne({ _id: 'app' }).lean();
        }
        return { success: true, data: { ...defaults, ...doc } };
    } catch (err) {
        logger.error('CMDHUB', 'getAdminConfig', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

export async function patchAdminConfig(request, reply) {
    try {
        const body = request.body || {};
        const update = {};
        if (body.aiModel !== undefined) update.aiModel = String(body.aiModel).trim() || 'gpt-3.5-turbo';
        if (body.aiTemperature !== undefined) update.aiTemperature = Math.max(0, Math.min(2, Number(body.aiTemperature) || 0.8));
        if (body.aiMaxTokens !== undefined) update.aiMaxTokens = Math.max(1, Math.min(4096, Number(body.aiMaxTokens) || 500));
        if (body.features && typeof body.features === 'object') {
            const current = await AppConfig.findOne({ _id: 'app' }).lean();
            const prev = current?.features || { ai: true, levels: true, moderation: true, routines: true };
            update.features = {
                ai: body.features.ai !== undefined ? Boolean(body.features.ai) : prev.ai,
                levels: body.features.levels !== undefined ? Boolean(body.features.levels) : prev.levels,
                moderation: body.features.moderation !== undefined ? Boolean(body.features.moderation) : prev.moderation,
                routines: body.features.routines !== undefined ? Boolean(body.features.routines) : prev.routines
            };
        }

        const doc = await AppConfig.findOneAndUpdate(
            { _id: 'app' },
            { $set: update },
            { new: true, upsert: true }
        ).lean();
        logger.info('CMDHUB', 'App config (admin) atualizado');
        return { success: true, data: doc };
    } catch (err) {
        logger.error('CMDHUB', 'patchAdminConfig', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// OPTIONS (listas para selects no front — público)
// ═══════════════════════════════════════════════════════════

export async function getSettingsOptions(request, reply) {
    try {
        const timezones = [
            { value: 'America/Sao_Paulo', label: 'São Paulo' },
            { value: 'Europe/London', label: 'Londres' },
            { value: 'America/New_York', label: 'Nova York' },
            { value: 'Europe/Paris', label: 'Paris' },
            { value: 'Europe/Berlin', label: 'Berlim' },
            { value: 'UTC', label: 'UTC' }
        ];
        const aiModels = [
            { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
            { value: 'gpt-4', label: 'GPT-4' },
            { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
            { value: 'gpt-4o', label: 'GPT-4o' }
        ];
        const locales = [
            { value: 'pt-BR', label: 'Português (BR)' },
            { value: 'en-GB', label: 'English (UK)' },
            { value: 'es', label: 'Español' },
            { value: 'fr', label: 'Français' }
        ];
        return {
            success: true,
            data: { timezones, aiModels, locales }
        };
    } catch (err) {
        logger.error('CMDHUB', 'getSettingsOptions', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

// ═══════════════════════════════════════════════════════════
// DISCORD METADATA (guilds e membros para dropdowns no front)
// ═══════════════════════════════════════════════════════════

export async function getDiscordGuilds(request, reply) {
    try {
        const client = nexus.getClient();
        if (!client || !client.isReady?.()) {
            reply.status(503);
            return { success: false, error: 'Discord client não está pronto.' };
        }
        const guilds = client.guilds.cache.map(g => ({
            id: g.id,
            name: g.name,
            iconUrl: g.iconURL?.() ?? null
        })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
        return { success: true, data: guilds };
    } catch (err) {
        logger.error('CMDHUB', 'getDiscordGuilds', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

export async function getDiscordGuildMembers(request, reply) {
    try {
        const guildId = request.query?.guildId;
        if (!guildId) {
            reply.status(400);
            return { success: false, error: 'guildId é obrigatório na query' };
        }
        const client = nexus.getClient();
        if (!client || !client.isReady?.()) {
            reply.status(503);
            return { success: false, error: 'Discord client não está pronto.' };
        }
        const guild = await client.guilds.fetch(guildId).catch(() => null);
        if (!guild) {
            reply.status(404);
            return { success: false, error: 'Guild não encontrada' };
        }
        const members = await guild.members.fetch({ limit: 250 }).catch(() => null);
        if (!members) {
            reply.status(500);
            return { success: false, error: 'Não foi possível carregar membros' };
        }
        const data = Array.from(members.values())
            .filter(m => !m.user.bot)
            .map(m => ({
                id: m.id,
                username: m.user.username,
                displayName: m.displayName || m.user.globalName || m.user.username
            }))
            .sort((a, b) => a.displayName.localeCompare(b.displayName, 'pt-BR'));
        return { success: true, data };
    } catch (err) {
        logger.error('CMDHUB', 'getDiscordGuildMembers', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}
