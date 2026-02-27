/**
 * DM-only AI tools: rotinas do usuário (ler e editar).
 * Usado apenas no fluxo DM; em servidor não expomos essas funções.
 * Lista e detalhe: enviam embed no Discord (mesmo formato do /rotina_listar) e resposta efêmera.
 */

import { EmbedBuilder } from 'discord.js';
import * as routineService from '../../../events/services/routineService.js';
import { buildListEmbedData, buildDetailEmbedData, cronToHuman } from '../../commands/routineFormatters.js';
import logger from '../../utils/logger.js';

/** Definições no formato OpenAI (tools array para chat/completions). */
export const DM_ROUTINE_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'list_routines',
            description: 'Lista as rotinas do usuário (dono ou participante). Use para mostrar a lista no mesmo formato do comando /rotina_listar.',
            parameters: { type: 'object', properties: {}, additionalProperties: false }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_routine',
            description: 'Obtém os detalhes de uma rotina pelo id, no mesmo formato da tela "Ver detalhes" do /rotina_listar. Use para mostrar uma rotina específica.',
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

/** Texto com dados da rotina para salvar no histórico (IA usa para criar/editar com precisão). */
function formatRoutineListForHistory(routines) {
    return routines.map((r, i) => {
        const { horario, repetir } = cronToHuman(r.cron);
        const rep = r.oneTime ? 'Uma vez só' : repetir;
        return `${i + 1}. id=${String(r._id)} | nome="${r.name}" | ${horario} ${rep} | ${r.enabled !== false ? 'ativa' : 'desativada'} | ${(r.items || []).length} itens`;
    }).join('\n');
}

/** Texto com detalhe completo da rotina para histórico (edição precisa). */
function formatRoutineDetailForHistory(routine) {
    const items = (routine.items || []).map((it, i) => `${i + 1}. ${it.label} (${it.condition || 'always'})`).join('\n');
    return [
        `id=${routine._id}`,
        `nome=${routine.name}`,
        `cron=${routine.cron}`,
        `timezone=${routine.timezone}`,
        `oneTime=${routine.oneTime}`,
        `enabled=${routine.enabled !== false}`,
        `itens:\n${items || 'nenhum'}`
    ].join('\n');
}

/**
 * Executa uma tool de rotina em nome do usuário (DM = só ele vê).
 * Para list_routines e get_routine: envia embed no Discord, salva info no histórico (1 por tipo nas últimas 50) e retorna texto curto para a IA.
 * @param {string} userId - Discord user ID
 * @param {string} name - list_routines | get_routine | update_routine | delete_routine
 * @param {object} args - Argumentos do tool
 * @param {{ message?: import('discord.js').Message, saveToolInfo?: (p: { toolType: string, content: string }) => Promise<void> }} [context]
 * @returns {Promise<string>} Resultado em texto para a IA
 */
export async function executeDmRoutineTool(userId, name, args = {}, context = {}) {
    try {
        switch (name) {
            case 'list_routines': {
                const routines = await routineService.getRoutinesByUser(userId, null);
                if (routines.length === 0) return 'Nenhuma rotina encontrada.';
                if (context?.message) {
                    const statusMsg = await context.message.reply({
                        content: '⏳ Frieren está preparando a lista das suas rotinas...',
                    }).catch(() => null);

                    const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
                    const data = buildListEmbedData(routines, userId, { baseUrl });
                    const embed = new EmbedBuilder()
                        .setTitle(data.title)
                        .setColor(data.color)
                        .setDescription(data.description)
                        .setFooter({ text: data.footer })
                        .setTimestamp();
                    await context.message.reply({ embeds: [embed] });
                    if (typeof context.saveToolInfo === 'function') {
                        const content = `[Dados das rotinas para referência - use os ids para get_routine/update_routine/delete_routine]\n${formatRoutineListForHistory(routines)}`;
                        await context.saveToolInfo({ toolType: 'list_routines', content });
                    }
                    if (statusMsg) {
                        try {
                            await statusMsg.edit('✅ Lista de rotinas atualizada.');
                            setTimeout(() => {
                                statusMsg.delete().catch(() => {});
                            }, 4000);
                        } catch {}
                    }
                    return 'O embed com a lista já foi enviado ao usuário. Responda APENAS com uma frase curta (ex: "Pronto!", "Aqui estão.") sem repetir nomes, horários ou blocos (├ └).';
                }
                const data = buildListEmbedData(routines, userId);
                return `${data.title}\n\n${data.description}\n\n_${data.footer}_`;
            }
            case 'get_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                const routine = await routineService.getRoutineByIdForUser(id, userId);
                if (!routine) return 'Rotina não encontrada ou você não tem acesso.';
                if (context?.message) {
                    const statusMsg = await context.message.reply({
                        content: '⏳ Frieren está buscando os detalhes dessa rotina...',
                    }).catch(() => null);

                    const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
                    const data = buildDetailEmbedData(routine, userId, { baseUrl });
                    const embed = new EmbedBuilder()
                        .setTitle(data.title)
                        .setColor(data.color)
                        .setDescription(data.description)
                        .addFields(data.fields)
                        .setTimestamp();
                    await context.message.reply({ embeds: [embed] });
                    if (typeof context.saveToolInfo === 'function') {
                        const content = `[Detalhe da rotina para edição - use update_routine com estes dados]\n${formatRoutineDetailForHistory(routine)}`;
                        await context.saveToolInfo({ toolType: 'get_routine', content });
                    }
                    if (statusMsg) {
                        try {
                            await statusMsg.edit('✅ Detalhes da rotina atualizados.');
                            setTimeout(() => {
                                statusMsg.delete().catch(() => {});
                            }, 4000);
                        } catch {}
                    }
                    return 'O embed com os detalhes já foi enviado ao usuário. Responda APENAS com uma frase curta (ex: "Pronto!", "Aqui está.") sem repetir dados da rotina.';
                }
                const data = buildDetailEmbedData(routine, userId);
                const text = `${data.title}\n\n${data.description}\n\n**${data.fields[0].name}**\n${data.fields[0].value}`;
                return text;
            }
            case 'update_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                const updates = {};
                if (args.name !== undefined) updates.name = String(args.name);
                if (args.cron !== undefined) updates.cron = String(args.cron);
                if (args.timezone !== undefined) updates.timezone = String(args.timezone);
                // Patch semantics: só altera itens quando um array não-vazio for enviado.
                // Isso evita que a IA envie [] sem querer e apague todos os itens.
                if (Array.isArray(args.items) && args.items.length > 0) {
                    updates.items = args.items;
                }
                if (args.oneTime !== undefined) updates.oneTime = Boolean(args.oneTime);
                let statusMsg = null;
                if (context?.message) {
                    statusMsg = await context.message.reply({
                        content: '⏳ Frieren está atualizando essa rotina...',
                    }).catch(() => null);
                }
                const updated = await routineService.updateRoutine(id, userId, updates);
                if (!updated) return JSON.stringify({ error: 'Rotina não encontrada ou você não é o dono.' });
                if (context?.message) {
                    const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
                    const data = buildDetailEmbedData(updated.toObject?.() || updated, userId, { baseUrl });
                    const embed = new EmbedBuilder()
                        .setTitle(data.title)
                        .setColor(data.color)
                        .setDescription(data.description)
                        .addFields(data.fields)
                        .setTimestamp();
                    await context.message.reply({ embeds: [embed] });
                    if (typeof context.saveToolInfo === 'function') {
                        const content = `[Rotina atualizada - estado atual para futuras edições]\n${formatRoutineDetailForHistory(updated.toObject?.() || updated)}`;
                        await context.saveToolInfo({ toolType: 'get_routine', content });
                    }
                }
                if (statusMsg) {
                    try {
                        await statusMsg.edit('✅ Rotina atualizada.');
                        setTimeout(() => {
                            statusMsg.delete().catch(() => {});
                        }, 4000);
                    } catch {}
                }
                return JSON.stringify({ ok: true, message: `Rotina "${updated.name}" atualizada.` });
            }
            case 'delete_routine': {
                const id = args.routine_id;
                if (!id) return JSON.stringify({ error: 'routine_id é obrigatório' });
                let statusMsg = null;
                if (context?.message) {
                    statusMsg = await context.message.reply({
                        content: '⏳ Frieren está removendo essa rotina...',
                    }).catch(() => null);
                }
                const deleted = await routineService.deleteRoutine(id, userId);
                if (!deleted) return JSON.stringify({ error: 'Rotina não encontrada ou você não é o dono.' });
                if (statusMsg) {
                    try {
                        await statusMsg.edit('✅ Rotina removida.');
                        setTimeout(() => {
                            statusMsg.delete().catch(() => {});
                        }, 4000);
                    } catch {}
                }
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
