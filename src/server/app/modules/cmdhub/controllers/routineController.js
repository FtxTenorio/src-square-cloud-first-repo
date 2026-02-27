/**
 * cmdhub - Routine Controller
 * HTTP handlers for routine delete (Life-Sync). Deleção também remove o schedule no EventBridge.
 */

import * as routineService from '../../events/services/routineService.js';
import * as userPreferenceService from '../../events/services/userPreferenceService.js';
import viewService from '../services/viewService.js';
import logger from '../../nexus/utils/logger.js';

/**
 * DELETE /routines/:id
 * Apaga uma rotina do usuário e o schedule no EventBridge (se existir).
 * Body ou query: { userId } (Discord user ID do dono da rotina).
 */
export async function deleteRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.body?.userId ?? request.query?.userId;
        if (!id) {
            reply.status(400);
            return { success: false, error: 'ID da rotina é obrigatório' };
        }
        if (!userId) {
            reply.status(400);
            return { success: false, error: 'userId é obrigatório (body ou query)' };
        }

        const routine = await routineService.deleteRoutine(id, userId);
        if (!routine) {
            reply.status(404);
            return { success: false, error: 'Rotina não encontrada ou você não é o dono' };
        }

        logger.http.request('DELETE', `/routines/${id}`, 200, 0);
        return {
            success: true,
            message: 'Rotina apagada',
            data: { id, name: routine.name }
        };
    } catch (err) {
        logger.error('CMDHUB', 'deleteRoutine', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

/**
 * GET /routines/:id/delete?userId=xxx
 * Permite apagar via link (ex.: link no embed do Discord). Retorna HTML com resultado.
 */
export async function getDeleteRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.query?.userId;
        if (!id || !userId) {
            reply.type('text/html').status(400);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'id e userId (query) são obrigatórios.'
            });
        }

        const routine = await routineService.deleteRoutine(id, userId);
        if (!routine) {
            reply.type('text/html').status(404);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'Rotina não encontrada ou você não é o dono.'
            });
        }

        logger.http.request('GET', `/routines/${id}/delete`, 200, 0);
        reply.type('text/html').status(200);
        return viewService.renderRoutineDeletePage({
            success: true,
            message: 'Rotina apagada.',
            routineName: routine.name
        });
    } catch (err) {
        logger.error('CMDHUB', 'getDeleteRoutine', err.message);
        reply.type('text/html').status(500);
        return viewService.renderRoutineDeletePage({
            success: false,
            message: err.message || 'Erro ao apagar rotina.'
        });
    }
}

/**
 * GET /routines/:id/edit?userId=xxx
 * Exibe formulário HTML para editar a rotina.
 */
export async function getEditRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.query?.userId;
        if (!id || !userId) {
            reply.type('text/html').status(400);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'id e userId (query) são obrigatórios.'
            });
        }
        const routine = await routineService.getRoutineById(id, userId);
        if (!routine) {
            reply.type('text/html').status(404);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'Rotina não encontrada ou você não é o dono.'
            });
        }
        const { horario } = cronToHuman(routine.cron);
        const repetir = routineService.cronToRepetirValue(routine.cron, routine.oneTime);
        const dias = repetir === 'varios_dias' ? routineService.cronToDiasString(routine.cron) : '';
        const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '') || `http://${request.headers.host || 'localhost'}`;
        const actionUrl = `${baseUrl}/routines/${id}/edit`;
        reply.type('text/html').status(200);
        return viewService.renderRoutineEditForm(routine, { horario, repetir, dias }, actionUrl, userId);
    } catch (err) {
        logger.error('CMDHUB', 'getEditRoutine', err.message);
        reply.type('text/html').status(500);
        return viewService.renderRoutineDeletePage({
            success: false,
            message: err.message || 'Erro ao carregar edição.'
        });
    }
}

/**
 * POST /routines/:id/edit
 * Processa o formulário de edição (body: userId, name, horario, repetir, timezone, itens, oneTime).
 */
export async function postEditRoutine(request, reply) {
    try {
        const { id } = request.params;
        const body = request.body || {};
        const userId = body.userId;
        if (!id || !userId) {
            reply.type('text/html').status(400);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'userId é obrigatório.'
            });
        }
        const { name, horario, repetir, timezone, itens, oneTime, dias } = body;
        const repetirForCron = repetir === 'varios_dias' ? (dias?.trim() || 'segunda, sexta') : (repetir || 'todo_dia');
        const cron = routineService.scheduleToCron(horario || '08:00', repetirForCron);
        const items = routineService.parseItemsString(itens || '');
        const routine = await routineService.updateRoutine(id, userId, {
            name: name || undefined,
            cron,
            timezone: timezone || undefined,
            items: items.length >= 0 ? items : undefined,
            oneTime: oneTime === '1' || oneTime === true
        });
        if (!routine) {
            reply.type('text/html').status(404);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'Rotina não encontrada ou você não é o dono.'
            });
        }
        let timezoneSaved = false;
        if (timezone && String(timezone).trim()) {
            await userPreferenceService.saveTimezone(userId, timezone);
            timezoneSaved = true;
        }
        logger.http.request('POST', `/routines/${id}/edit`, 200, 0);
        reply.type('text/html').status(200);
        return viewService.renderRoutineEditSuccess(routine.name, { timezoneSaved });
    } catch (err) {
        logger.error('CMDHUB', 'postEditRoutine', err.message);
        reply.type('text/html').status(500);
        return viewService.renderRoutineDeletePage({
            success: false,
            message: err.message || 'Erro ao salvar.'
        });
    }
}

/**
 * POST /routines/:id/leave
 * Remove o usuário autenticado (via userId no body ou query) da lista de participantes.
 */
export async function postLeaveRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.body?.userId ?? request.query?.userId;
        if (!id) {
            reply.status(400);
            return { success: false, error: 'ID da rotina é obrigatório' };
        }
        if (!userId) {
            reply.status(400);
            return { success: false, error: 'userId é obrigatório (body ou query)' };
        }

        const routine = await routineService.leaveRoutineForUser(id, userId);
        if (!routine) {
            reply.status(404);
            return { success: false, error: 'Rotina não encontrada ou você não é participante' };
        }

        logger.http.request('POST', `/routines/${id}/leave`, 200, 0);
        return {
            success: true,
            message: 'Você saiu desta rotina.',
            data: { id, name: routine.name }
        };
    } catch (err) {
        logger.error('CMDHUB', 'postLeaveRoutine', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}

/**
 * GET /routines/:id/leave?userId=xxx
 * Permite sair via link (ex.: link no embed do Discord). Retorna HTML com resultado.
 */
export async function getLeaveRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.query?.userId;
        if (!id || !userId) {
            reply.type('text/html').status(400);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'id e userId (query) são obrigatórios.'
            });
        }

        const routine = await routineService.leaveRoutineForUser(id, userId);
        if (!routine) {
            reply.type('text/html').status(404);
            return viewService.renderRoutineDeletePage({
                success: false,
                message: 'Rotina não encontrada ou você não é participante desta rotina.'
            });
        }

        logger.http.request('GET', `/routines/${id}/leave`, 200, 0);
        reply.type('text/html').status(200);
        return viewService.renderRoutineDeletePage({
            success: true,
            message: 'Você saiu desta rotina.',
            routineName: routine.name
        });
    } catch (err) {
        logger.error('CMDHUB', 'getLeaveRoutine', err.message);
        reply.type('text/html').status(500);
        return viewService.renderRoutineDeletePage({
            success: false,
            message: err.message || 'Erro ao sair da rotina.'
        });
    }
}

function cronToHuman(cron) {
    if (!cron || typeof cron !== 'string') return { horario: '08:00' };
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return { horario: '08:00' };
    const [min, hr] = parts;
    const hour = parseInt(hr, 10);
    const minute = parseInt(min, 10);
    return { horario: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}` };
}
