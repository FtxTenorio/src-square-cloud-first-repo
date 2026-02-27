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
 * @param {object} data - { userId, guildId?, name, cron, timezone, items, oneTime?, participantIds? }
 * @returns {Promise<object>} Saved routine document (com scheduleId se criado)
 */
export async function createRoutine(data) {
    const { userId, guildId, name, cron, timezone, items = [], oneTime = false, participantIds } = data;
    if (!userId || !name || !cron || !timezone) {
        throw new Error('userId, name, cron e timezone são obrigatórios');
    }
    const participants = Array.isArray(participantIds)
        ? [...new Set(participantIds.map(String).filter(id => id && id !== userId))]
        : [];
    const routine = await Routine.create({
        userId,
        guildId: guildId ?? null,
        name: name.trim(),
        cron: cron.trim(),
        timezone: (timezone || 'Europe/London').trim(),
        items: Array.isArray(items) ? items : [],
        oneTime: Boolean(oneTime),
        participantIds: participants
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
 * List routines visíveis para um usuário (dono ou participante) e opcionalmente por guild.
 * Ordenado do mais novo ao mais antigo.
 * @param {string} userId - Discord user ID
 * @param {string} [guildId] - Optional guild filter
 */
export async function getRoutinesByUser(userId, guildId = null) {
    const query = {
        $or: [
            { userId },
            { participantIds: userId }
        ]
    };
    if (guildId != null) query.guildId = guildId;
    logger.debug?.('EVENTS', `getRoutinesByUser query`, { userId, guildId, query });
    const routines = await Routine.find(query).sort({ createdAt: -1 }).lean();
    logger.info('EVENTS', `getRoutinesByUser → ${routines.length} rotina(s) para user=${userId} guild=${guildId ?? 'any'}`);
    return routines;
}

/**
 * Desativa uma rotina após rodar uma vez (oneTime): remove o schedule e marca enabled = false.
 * Usado pelo trigger após enviar a DM quando routine.oneTime === true.
 */
export async function disableRoutine(routineId) {
    const routine = await Routine.findOne({ _id: routineId });
    if (!routine) return null;
    if (routine.scheduleId && eventBridge.isConfigured()) {
        try {
            await eventBridge.deleteSchedule(routine.scheduleId);
        } catch (err) {
            logger.warn('EVENTS', `Erro ao remover schedule ${routine.scheduleId}: ${err.message}`);
        }
    }
    routine.scheduleId = null;
    routine.enabled = false;
    await routine.save();
    logger.info('EVENTS', `Rotina desativada (uma vez): ${routine.name} (${routineId})`);
    return routine;
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
 * Update a routine. Se cron ou timezone mudarem e houver scheduleId, recria o schedule no EventBridge.
 * Rotina desativada (uma vez já executada) ao ser editada volta a ficar ativa e ganha schedule de novo.
 * @param {string} id - Routine ID
 * @param {string} userId - Owner user ID
 * @param {object} updates - { name?, cron?, timezone?, items?, oneTime? }
 */
export async function updateRoutine(id, userId, updates) {
    const routine = await Routine.findOne({ _id: id, userId });
    if (!routine) return null;
    const { name, cron, timezone, items, oneTime } = updates;
    const oldCron = routine.cron;
    const oldTz = routine.timezone;

    if (routine.enabled === false) {
        routine.enabled = true;
    }
    if (name !== undefined) routine.name = name.trim();
    if (cron !== undefined) routine.cron = cron.trim();
    if (timezone !== undefined) routine.timezone = timezone.trim();
    if (items !== undefined) routine.items = Array.isArray(items) ? items : routine.items;
    if (oneTime !== undefined) routine.oneTime = Boolean(oneTime);

    const cronChanged = cron !== undefined && routine.cron !== oldCron;
    const tzChanged = timezone !== undefined && routine.timezone !== oldTz;
    const mustUpdateSchedule = routine.scheduleId && eventBridge.isConfigured() && (cronChanged || tzChanged);

    if (mustUpdateSchedule) {
        try {
            await eventBridge.deleteSchedule(routine.scheduleId);
            routine.scheduleId = null;
        } catch (err) {
            logger.warn('EVENTS', `Erro ao remover schedule ${routine.scheduleId}: ${err.message}`);
        }
    }
    await routine.save();

    if (routine.enabled && !routine.scheduleId && eventBridge.isConfigured()) {
        try {
            const scheduleName = await eventBridge.createSchedule(routine._id.toString(), routine.cron, routine.timezone);
            if (scheduleName) {
                routine.scheduleId = scheduleName;
                await routine.save();
            }
        } catch (err) {
            logger.warn('EVENTS', `Schedule não recriado para ${routine._id}: ${err.message}`);
        }
    }
    logger.info('EVENTS', `Rotina atualizada: ${routine.name} (${id})`);
    return routine;
}

/**
 * Retorna o valor "repetir" (para formulário) a partir do cron. oneTime deve ser passado para mapear * → uma_vez.
 * Se dow tiver vírgula (vários dias), retorna "varios_dias".
 */
export function cronToRepetirValue(cron, oneTime = false) {
    if (!cron || typeof cron !== 'string') return 'todo_dia';
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return 'todo_dia';
    const dow = parts[4];
    if (oneTime) return 'uma_vez';
    if (dow.includes(',')) return 'varios_dias';
    const map = { '*': 'todo_dia', '1-5': 'seg_a_sex', '0,6': 'fim_de_semana', '0': 'domingo', '1': 'segunda', '2': 'terca', '3': 'quarta', '4': 'quinta', '5': 'sexta', '6': 'sabado' };
    return map[dow] ?? 'todo_dia';
}

const CRON_NUM_TO_DAY_KEY = { '0': 'domingo', '1': 'segunda', '2': 'terca', '3': 'quarta', '4': 'quinta', '5': 'sexta', '6': 'sabado' };

/**
 * Retorna string de dias para o formulário de edição quando cron tem vários dias (ex.: "1,5" → "segunda, sexta").
 */
export function cronToDiasString(cron) {
    if (!cron || typeof cron !== 'string') return '';
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return '';
    const dow = parts[4];
    if (!dow.includes(',')) return '';
    return dow.split(',').map(n => CRON_NUM_TO_DAY_KEY[n.trim()] || '').filter(Boolean).join(', ');
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
 * Remove um usuário da lista de participantes de uma rotina.
 * Não permite que o dono "saia" — ele deve apagar ou editar.
 */
export async function leaveRoutineForUser(id, userId) {
    const routine = await Routine.findOne({ _id: id });
    if (!routine) return null;
    if (routine.userId === userId) {
        return null;
    }
    const current = Array.isArray(routine.participantIds) ? routine.participantIds : [];
    if (!current.includes(userId)) {
        return null;
    }
    routine.participantIds = current.filter(pid => pid !== userId);
    await routine.save();
    logger.info('EVENTS', `Usuário ${userId} saiu da rotina ${routine.name} (${id})`);
    return routine;
}

const DOW_TO_CRON = { domingo: '0', segunda: '1', terca: '2', quarta: '3', quinta: '4', sexta: '5', sabado: '6' };
const CRON_TO_DOW_LABEL = { '0': 'Domingo', '1': 'Segunda', '2': 'Terça', '3': 'Quarta', '4': 'Quinta', '5': 'Sexta', '6': 'Sábado' };

/**
 * Convert user-friendly time + recurrence to cron (min hour * * dow).
 * @param {string} horario - "08:00" or "8:30" (HH:mm or H:mm)
 * @param {string} repetir - todo_dia, seg_a_sex, fim_de_semana, uma_vez, um dia, ou vários: "segunda, sexta" / "segunda, terça, quinta, sexta, domingo"
 * @returns {string} cron expression, e.g. "0 8 * * 1-5" or "0 8 * * 1,5"
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
        uma_vez: '*',
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

    let dow;
    const repetirTrim = (repetir || '').trim();
    if (repetirTrim.includes(',')) {
        const days = repetirTrim.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
        const nums = days.map(d => DOW_TO_CRON[d]).filter(Boolean);
        if (nums.length === 0) throw new Error('Dias inválidos. Use: segunda, terça, quarta, quinta, sexta, sábado, domingo (separados por vírgula).');
        nums.sort((a, b) => parseInt(a, 10) - parseInt(b, 10));
        dow = [...new Set(nums)].join(',');
    } else {
        dow = dowMap[repetirTrim] ?? '*';
    }
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
    updateRoutine,
    deleteRoutine,
    leaveRoutineForUser,
    disableRoutine,
    scheduleToCron,
    cronToRepetirValue,
    cronToDiasString,
    getTimezoneFromLocale,
    parseItemsString
};
