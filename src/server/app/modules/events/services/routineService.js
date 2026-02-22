/**
 * events (Life-Sync Engine) - Routine Service
 * Create, list, get, update, delete routines.
 * Integra com EventBridge Scheduler quando configurado (EVENTBRIDGE_LAMBDA_ARN).
 */

import Routine from '../models/Routine.js';
import * as eventBridge from './eventBridgeScheduler.js';
import logger from '../../nexus/utils/logger.js';

/**
 * Create a new routine and, se configurado, cria schedule no EventBridge.
 * @param {object} data - { userId, guildId?, name, cron, timezone, items }
 * @returns {Promise<object>} Saved routine document (com scheduleId se criado)
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

    if (eventBridge.isConfigured()) {
        try {
            const scheduleName = await eventBridge.createSchedule(routine._id.toString(), routine.cron, routine.timezone);
            if (scheduleName) {
                routine.scheduleId = scheduleName;
                await routine.save();
            }
        } catch (err) {
            logger.warn('EVENTS', `Schedule não criado para ${routine._id}: ${err.message}`);
        }
    }
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
 * Delete a routine e o schedule no EventBridge (se existir).
 */
export async function deleteRoutine(id, userId) {
    const routine = await Routine.findOne({ _id: id, userId });
    if (!routine) return null;
    if (routine.scheduleId && eventBridge.isConfigured()) {
        try {
            await eventBridge.deleteSchedule(routine.scheduleId);
        } catch (err) {
            logger.warn('EVENTS', `Erro ao remover schedule ${routine.scheduleId}: ${err.message}`);
        }
    }
    await Routine.findOneAndDelete({ _id: id, userId });
    logger.info('EVENTS', `Rotina removida: ${routine.name} (${id})`);
    return routine;
}

/**
 * Convert user-friendly time + recurrence to cron (min hour * * dow).
 * @param {string} horario - "08:00" or "8:30" (HH:mm or H:mm)
 * @param {string} repetir - one of: todo_dia, seg_a_sex, fim_de_semana, domingo..sabado
 * @returns {string} cron expression, e.g. "0 8 * * 1-5"
 */
export function scheduleToCron(horario, repetir) {
    const match = (horario || '').trim().match(/^(\d{1,2}):(\d{2})$/);
    if (!match) throw new Error('Horário inválido. Use formato 08:00 ou 8:30');
    const hour = Math.max(0, Math.min(23, parseInt(match[1], 10)));
    const minute = Math.max(0, Math.min(59, parseInt(match[2], 10)));
    const min = String(minute);
    const hr = String(hour);
    const dowMap = {
        todo_dia: '*',
        seg_a_sex: '1-5',
        fim_de_semana: '0,6',
        domingo: '0',
        segunda: '1',
        terca: '2',
        quarta: '3',
        quinta: '4',
        sexta: '5',
        sabado: '6'
    };
    const dow = dowMap[repetir] ?? '*';
    return `${min} ${hr} * * ${dow}`;
}

/**
 * Map Discord user/guild locale to IANA timezone (default for rotina).
 */
export function getTimezoneFromLocale(locale) {
    const map = {
        'pt-BR': 'America/Sao_Paulo',
        'pt': 'America/Sao_Paulo',
        'en-GB': 'Europe/London',
        'en-US': 'America/New_York',
        'es': 'Europe/Madrid',
        'es-419': 'America/Mexico_City',
        'fr': 'Europe/Paris',
        'de': 'Europe/Berlin',
        'it': 'Europe/Rome',
        'ja': 'Asia/Tokyo',
        'ko': 'Asia/Seoul'
    };
    const base = (locale || 'en-GB').split('-')[0];
    return map[locale] ?? map[base] ?? 'Europe/London';
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
    scheduleToCron,
    getTimezoneFromLocale,
    parseItemsString
};
