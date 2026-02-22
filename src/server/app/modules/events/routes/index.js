/**
 * events - HTTP routes (webhook para EventBridge Scheduler → Lambda → aqui)
 */

import { EmbedBuilder } from 'discord.js';
import * as routineService from '../services/routineService.js';
import nexus from '../../nexus/index.js';
import logger from '../../nexus/utils/logger.js';

async function eventsRoutes(fastify) {
    /**
     * POST /events/routine-trigger
     * Chamado pela Lambda quando o EventBridge Scheduler dispara (ou por teste).
     * Body: { routineId: string }
     * Envia DM ao usuário com o nome da rotina e os items (checklist).
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

            const client = nexus.getClient();
            if (client?.isReady()) {
                try {
                    const user = await client.users.fetch(routine.userId);
                    const items = routine.items ?? [];
                    const checklist = items.length > 0
                        ? items.map((item, i) => `☐ ${i + 1}. ${item.label}`).join('\n')
                        : '_Nenhum item nesta rotina._';
                    const embed = new EmbedBuilder()
                        .setTitle(`⏰ ${routine.name}`)
                        .setDescription('Sua rotina do horário chegou!\n\n**Checklist:**\n' + checklist)
                        .setColor(0x5865F2)
                        .setTimestamp();
                    await user.send({ embeds: [embed] });
                    logger.info('EVENTS', `DM enviada para ${routine.userId} (rotina: ${routine.name})`);
                } catch (dmErr) {
                    logger.warn('EVENTS', `Não foi possível enviar DM ao usuário ${routine.userId}: ${dmErr.message}`);
                }
            } else {
                logger.warn('EVENTS', 'Bot Discord não está pronto; DM da rotina não enviada');
            }

            return {
                success: true,
                routineId,
                name: routine.name,
                items: routine.items?.length ?? 0
            };
        } catch (err) {
            logger.error('EVENTS', 'routine-trigger', err.message);
            reply.status(500);
            return { success: false, error: err.message };
        }
    });
}

export default eventsRoutes;
