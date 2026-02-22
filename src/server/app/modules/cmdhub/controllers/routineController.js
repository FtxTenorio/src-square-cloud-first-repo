/**
 * cmdhub - Routine Controller
 * HTTP handlers for routine delete (Life-Sync). Deleção também remove o schedule no EventBridge.
 */

import * as routineService from '../../events/services/routineService.js';
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
 * Permite apagar via link (ex.: link no embed do Discord). Chama o backend diretamente.
 */
export async function getDeleteRoutine(request, reply) {
    try {
        const { id } = request.params;
        const userId = request.query?.userId;
        if (!id || !userId) {
            reply.status(400);
            return { success: false, error: 'id e userId (query) são obrigatórios' };
        }

        const routine = await routineService.deleteRoutine(id, userId);
        if (!routine) {
            reply.status(404);
            return { success: false, error: 'Rotina não encontrada ou você não é o dono' };
        }

        logger.http.request('GET', `/routines/${id}/delete`, 200, 0);
        return {
            success: true,
            message: `Rotina "${routine.name}" apagada.`,
            data: { id, name: routine.name }
        };
    } catch (err) {
        logger.error('CMDHUB', 'getDeleteRoutine', err.message);
        reply.status(500);
        return { success: false, error: err.message };
    }
}
