/**
 * events - User Preference Service
 * Salva e recupera preferências do usuário (timezone, etc.).
 */

import UserPreference from '../models/UserPreference.js';
import logger from '../../nexus/utils/logger.js';

/**
 * Retorna o timezone salvo nas preferências do usuário, ou null.
 * @param {string} userId - Discord user ID
 * @returns {Promise<string|null>}
 */
export async function getTimezone(userId) {
    if (!userId) return null;
    const doc = await UserPreference.findOne({ userId }).lean();
    return doc?.timezone && doc.timezone.trim() ? doc.timezone.trim() : null;
}

/**
 * Salva o timezone nas preferências do usuário (upsert).
 * @param {string} userId - Discord user ID
 * @param {string} timezone - IANA timezone (ex: America/Sao_Paulo)
 * @returns {Promise<object>} Documento salvo
 */
export async function saveTimezone(userId, timezone) {
    if (!userId || !timezone || typeof timezone !== 'string') return null;
    const tz = timezone.trim();
    if (!tz) return null;
    const doc = await UserPreference.findOneAndUpdate(
        { userId },
        { $set: { timezone: tz } },
        { new: true, upsert: true }
    );
    logger.info('EVENTS', `Preferência timezone salva: ${userId} → ${tz}`);
    return doc;
}

/**
 * Salva configurações de IA em DM nas preferências do usuário (admin.dm*).
 * Todos os campos são opcionais; quando null/undefined, o campo é limpo (usa config global).
 * @param {string} userId
 * @param {{ dmModel?: string | null, dmTemperature?: number | null, dmMaxTokens?: number | null }} admin
 */
export async function saveAdminDmAIConfig(userId, admin = {}) {
    if (!userId || !admin || typeof admin !== 'object') return null;
    const update = {};
    if ('dmModel' in admin) {
        update['admin.dmModel'] = admin.dmModel && String(admin.dmModel).trim() ? String(admin.dmModel).trim() : null;
    }
    if ('dmTemperature' in admin) {
        const v = admin.dmTemperature;
        update['admin.dmTemperature'] = v === null || v === undefined ? null : Number(v);
    }
    if ('dmMaxTokens' in admin) {
        const v = admin.dmMaxTokens;
        update['admin.dmMaxTokens'] = v === null || v === undefined ? null : Number(v);
    }
    if (Object.keys(update).length === 0) return null;
    const doc = await UserPreference.findOneAndUpdate(
        { userId },
        { $set: update },
        { new: true, upsert: true }
    );
    logger.info('EVENTS', `Preferência admin.dm* salva para ${userId}`, update);
    return doc;
}

/**
 * Retorna todas as preferências do usuário.
 * @param {string} userId - Discord user ID
 */
export async function getPreferences(userId) {
    if (!userId) return null;
    return UserPreference.findOne({ userId }).lean();
}

export default {
    getTimezone,
    saveTimezone,
    saveAdminDmAIConfig,
    getPreferences
};
