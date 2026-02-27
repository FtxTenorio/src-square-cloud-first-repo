/**
 * DM-only AI tools: rotinas do usuário (ler e editar).
 * Usado apenas no fluxo DM; em servidor não expomos essas funções.
 */

import * as routineService from '../../../events/services/routineService.js';
import logger from '../../utils/logger.js';

/** Definições no formato OpenAI (tools array para chat/completions). */
export const DM_ROUTINE_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'list_routines',
            description: 'Lista as rotinas do usuário (das quais ele é dono ou participante). Retorna id, nome, horário (cron), ativa/desativada, quantidade de itens.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_routine',
            description: 'Obtém os detalhes completos de uma rotina pelo id (nome, horário, fuso, itens, uma vez só, ativa, participantes). Só retorna se o usuário for dono ou participante.',
            parameters: {
                type: 'object',
                properties: {
                    routine_id: { type: 'string', description: 'ID da rotina (Mongo ObjectId)' }
                },
                required: ['routine_id'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'update_routine',
            description: 'Atualiza uma rotina existente. Apenas o dono pode atualizar. Pode alterar nome, horário (cron), timezone, itens (array de {label, condition}), oneTime.',
            parameters: {
                type: 'object',
                properties: {
                    routine_id: { type: 'string', description: 'ID da rotina' },
                    name: { type: 'string', description: 'Novo nome da rotina' },
                    cron: { type: 'string', description: 'Expressão cron (ex: 0 8 * * 1-5 para 08:00 seg a sex)' },
                    timezone: { type: 'string', description: 'Fuso IANA (ex: America/Sao_Paulo)' },
                    items: {
                        type: 'array',
                        description: 'Lista de itens: [{ label: string, condition?: string }]',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                condition: { type: 'string' }
                            },
                            required: ['label']
                        }
                    },
                    oneTime: { type: 'boolean', description: 'Se true, rotina executa uma vez só' }
                },
                required: ['routine_id'],
                additionalProperties: false
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'delete_routine',
            description: 'Remove uma rotina. Apenas o dono pode apagar.',
            parameters: {
                type: 'object',
                properties: {
                    routine_id: { type: 'string', description: 'ID da rotina' }
                },
                required: ['routine_id'],
                additionalProperties: false
            }
        }
    }
];

/**
 * Executa uma tool de rotina em nome do usuário (DM = só ele vê, sem checagem de guild).
 * @param {string} userId - Discord user ID
 * @param {string} name - list_routines | get_routine | update_routine | delete_routine
 * @param {object} args - Argumentos do tool (ex: { routine_id }, { routine_id, name }, etc.)
 * @returns {Promise<string>} Resultado em texto para a IA (JSON ou mensagem amigável)
 */
export async function executeDmRoutineTool(userId, name, args = {}) {
    try {
        switch (name) {
            case 'list_routines': {
                const routines = await routineService.getRoutinesByUser(userId, null);
                const list = routines.map(r => ({
                    id: String(r._id),
                    name: r.name,
                    cron: r.cron,
                    enabled: r.enabled !== false,
                    itemsCount: (r.items || []).length,
                    oneTime: r.oneTime === true
                }));
                return JSON.stringify(list, null, 2);
            }
            case 'get_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                const routine = await routineService.getRoutineByIdForUser(id, userId);
                if (!routine) return JSON.stringify({ error: 'Rotina não encontrada ou você não tem acesso.' });
                return JSON.stringify(routine, null, 2);
            }
            case 'update_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                const updates = {};
                if (args.name !== undefined) updates.name = String(args.name);
                if (args.cron !== undefined) updates.cron = String(args.cron);
                if (args.timezone !== undefined) updates.timezone = String(args.timezone);
                if (args.items !== undefined) updates.items = Array.isArray(args.items) ? args.items : [];
                if (args.oneTime !== undefined) updates.oneTime = Boolean(args.oneTime);
                const updated = await routineService.updateRoutine(id, userId, updates);
                if (!updated) return JSON.stringify({ error: 'Rotina não encontrada ou você não é o dono.' });
                return JSON.stringify({ ok: true, message: `Rotina "${updated.name}" atualizada.` });
            }
            case 'delete_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                const deleted = await routineService.deleteRoutine(id, userId);
                if (!deleted) return JSON.stringify({ error: 'Rotina não encontrada ou você não é o dono.' });
                return JSON.stringify({ ok: true, message: `Rotina "${deleted.name}" removida.` });
            }
            default:
                return JSON.stringify({ error: `Função desconhecida: ${name}` });
        }
    } catch (err) {
        logger.error('AI', `dmRoutineTool ${name}`, err.message);
        return JSON.stringify({ error: err.message || 'Erro ao executar.' });
    }
}

export default { DM_ROUTINE_TOOLS, executeDmRoutineTool };
