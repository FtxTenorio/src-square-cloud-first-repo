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
    getPreferences
};
