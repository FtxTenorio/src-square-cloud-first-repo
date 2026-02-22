/**
 * events (Life-Sync Engine) - Routine Service
 * Create, list, get, update, delete routines.
 * Phase 1: MongoDB only. Later: AWS EventBridge Scheduler + Redis state.
 */

import Routine from '../models/Routine.js';
import logger from '../../nexus/utils/logger.js';

/**
 * Create a new routine
 * @param {object} data - { userId, guildId?, name, cron, timezone, items }
 * @returns {Promise<object>} Saved routine document
 */
export async function createRoutine(data) {
    const { userId, guildId, name, cron, timezone, items = [] } = data;
    if (!userId || !name || !cron || !timezone) {
        throw new Error('userId, name, cron e timezone são obrigatórios');
    }
    const routine = await Routine.create({
        userId,
        guildId: guildId ?? null,
        name: name.trim(),
        cron: cron.trim(),
        timezone: (timezone || 'Europe/London').trim(),
        items: Array.isArray(items) ? items : []
    });
    logger.info('EVENTS', `Rotina criada: ${routine.name} (${routine._id}) por ${userId}`);
    return routine;
}

/**
 * List routines by user (and optional guild)
 * @param {string} userId - Discord user ID
 * @param {string} [guildId] - Optional guild filter
 */
export async function getRoutinesByUser(userId, guildId = null) {
    const query = { userId };
    if (guildId != null) query.guildId = guildId;
    return Routine.find(query).sort({ createdAt: -1 }).lean();
}

/**
 * Get a single routine by id (and optional userId for ownership check)
 */
export async function getRoutineById(id, userId = null) {
    const query = { _id: id };
    if (userId) query.userId = userId;
    return Routine.findOne(query).lean();
}

/**
 * Delete a routine (Phase 1: only Mongo; later: also remove EventBridge schedule)
 */
export async function deleteRoutine(id, userId) {
    const routine = await Routine.findOneAndDelete({ _id: id, userId });
    if (!routine) return null;
    logger.info('EVENTS', `Rotina removida: ${routine.name} (${id})`);
    return routine;
}

/**
 * Parse items string from slash command into [{ label, condition }]
 * Format: "Label 1|condition1, Label 2|always" or one per line
 */
export function parseItemsString(str) {
    if (!str || typeof str !== 'string') return [];
    const lines = str.split(/[\n,]/).map(s => s.trim()).filter(Boolean);
    return lines.map(line => {
        const pipe = line.indexOf('|');
        if (pipe === -1) {
            return { label: line, condition: 'always' };
        }
        return {
            label: line.slice(0, pipe).trim(),
            condition: line.slice(pipe + 1).trim() || 'always'
        };
    });
}

export default {
    createRoutine,
    getRoutinesByUser,
    getRoutineById,
    deleteRoutine,
    parseItemsString
};
