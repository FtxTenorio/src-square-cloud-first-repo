/**
 * events - HTTP routes (webhook para EventBridge Scheduler → Lambda → aqui)
 */

import * as routineService from '../services/routineService.js';
import logger from '../../nexus/utils/logger.js';

async function eventsRoutes(fastify) {
    /**
     * POST /events/routine-trigger
     * Chamado pela Lambda quando o EventBridge Scheduler dispara (ou por teste).
     * Body: { routineId: string }
     */
    fastify.post('/events/routine-trigger', async (request, reply) => {
        try {
            const { routineId } = request.body || {};
            if (!routineId) {
                reply.status(400);
                return { success: false, error: 'routineId é obrigatório' };
            }
            const routine = await routineService.getRoutineById(routineId);
            if (!routine) {
                reply.status(404);
                return { success: false, error: 'Rotina não encontrada' };
            }
            logger.info('EVENTS', `Trigger rotina: ${routine.name} (${routineId})`);
            // Fase 1: só loga. Depois: resolvers (clima, agenda), montar checklist, enviar Discord, Redis state.
            return {
                success: true,
                routineId,
                name: routine.name,
                items: routine.items?.length ?? 0,
                message: 'Trigger recebido; execução completa em fase posterior'
            };
        } catch (err) {
            logger.error('EVENTS', 'routine-trigger', err.message);
            reply.status(500);
            return { success: false, error: err.message };
        }
    });
}

export default eventsRoutes;
