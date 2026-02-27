/**
 * Nexus - Routine Commands (Life-Sync Engine)
 * Slash commands for creating and listing routines.
 * Data is stored in the events module (MongoDB); later: AWS EventBridge + Redis.
 */

import {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle
} from 'discord.js';
import * as routineService from '../../events/services/routineService.js';
import * as userPreferenceService from '../../events/services/userPreferenceService.js';
import logger from '../utils/logger.js';

const TIMEZONE_CHOICES = [
    { name: '🇧🇷 São Paulo', value: 'America/Sao_Paulo' },
    { name: '🇬🇧 Londres', value: 'Europe/London' },
    { name: '🇺🇸 Nova York', value: 'America/New_York' },
    { name: '🇫🇷 Paris', value: 'Europe/Paris' },
    { name: '🇩🇪 Berlim', value: 'Europe/Berlin' },
    { name: 'UTC', value: 'UTC' }
];

const REPETIR_CHOICES = [
    { name: 'Uma vez só (não repetir)', value: 'uma_vez' },
    { name: 'Todo dia', value: 'todo_dia' },
    { name: 'Segunda a Sexta', value: 'seg_a_sex' },
    { name: 'Fim de semana (Sáb e Dom)', value: 'fim_de_semana' },
    { name: 'Vários dias (ex: segunda, sexta)', value: 'varios_dias' },
    { name: 'Segunda', value: 'segunda' },
    { name: 'Terça', value: 'terca' },
    { name: 'Quarta', value: 'quarta' },
    { name: 'Quinta', value: 'quinta' },
    { name: 'Sexta', value: 'sexta' },
    { name: 'Sábado', value: 'sabado' },
    { name: 'Domingo', value: 'domingo' }
];

/** Cron (min hr * * dow) → { horario: "08:00", repetir: "Segunda a Sexta" } */
function cronToHuman(cron) {
    if (!cron || typeof cron !== 'string') return { horario: '—', repetir: '—' };
    const parts = cron.trim().split(/\s+/);
    if (parts.length < 5) return { horario: cron, repetir: '—' };
    const [min, hr] = parts;
    const dow = parts[4];
    const hour = parseInt(hr, 10);
    const minute = parseInt(min, 10);
    const horario = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    const dowLabels = {
        '*': 'Todo dia',
        '1-5': 'Segunda a Sexta',
        '0,6': 'Fim de semana (Sáb e Dom)',
        '0': 'Domingo', '1': 'Segunda', '2': 'Terça', '3': 'Quarta',
        '4': 'Quinta', '5': 'Sexta', '6': 'Sábado'
    };
    const repetir = dow.includes(',')
        ? dow.split(',').map(n => dowLabels[n.trim()] || n).filter(Boolean).join(', ')
        : (dowLabels[dow] ?? dow);
    return { horario, repetir };
}

/** "segunda, sexta" → "Segunda, Sexta" */
function formatDiasLabel(diasStr) {
    if (!diasStr) return 'Vários dias';
    const labels = { domingo: 'Domingo', segunda: 'Segunda', terca: 'Terça', quarta: 'Quarta', quinta: 'Quinta', sexta: 'Sexta', sabado: 'Sábado' };
    return diasStr.split(',').map(s => labels[s.trim().toLowerCase()] || s.trim()).filter(Boolean).join(', ');
}

/** IANA timezone → nome curto para exibição */
function timezoneToLabel(tz) {
    if (!tz) return '—';
    const found = TIMEZONE_CHOICES.find(c => c.value === tz);
    return found ? found.name : tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
}

/** Máximo de opções de usuário no slash (Discord limita 25 opções por comando; temos 6 fixas). */
const MAX_PARTICIPANT_OPTIONS = 10;

function buildRotinaCriarData() {
    const builder = new SlashCommandBuilder()
        .setName('rotina_criar')
        .setDescription('Cria uma rotina (checklist no horário que você escolher)')
        .addStringOption(o => o
            .setName('nome')
            .setDescription('Nome da rotina (ex: Check-out de Saída)')
            .setRequired(false))
        .addStringOption(o => o
            .setName('horario')
            .setDescription('Horário (ex: 08:00 ou 8:30)')
            .setRequired(false))
        .addStringOption(o => o
            .setName('repetir')
            .setDescription('Em quais dias repetir')
            .setRequired(false)
            .addChoices(...REPETIR_CHOICES))
        .addStringOption(o => o
            .setName('itens')
            .setDescription('Itens: "Coisa a fazer" ou "Coisa|sempre". Vírgula entre cada.')
            .setRequired(false))
        .addStringOption(o => o
            .setName('dias')
            .setDescription('Quando "Vários dias": ex. segunda, sexta ou segunda, terça, quinta')
            .setRequired(false))
        .addStringOption(o => o
            .setName('timezone')
            .setDescription('Seu fuso (opcional; padrão: do seu Discord)')
            .setRequired(false)
            .addChoices(...TIMEZONE_CHOICES));
    for (let i = 1; i <= MAX_PARTICIPANT_OPTIONS; i++) {
        builder.addUserOption(o => o
            .setName(`usuario${i}`)
            .setDescription(i === 1 ? 'Usuário incluído nesta rotina' : `Outro usuário (${i}º)`)
            .setRequired(false));
    }
    return builder;
}

const ROTINA_CRIAR_MODAL_PREFIX = 'rotina_criar_modal:';
const ROTINA_CRIAR_ITEM_MODAL_ID = 'rotina_criar_item_modal';
const ROTINA_CRIAR_OPEN_FORM_BUTTON_ID = 'rotina_criar_open_form';
const ROTINA_CRIAR_SELECT_REPETIR_ID = 'rotina_criar_select_repetir';
/** Tratado no Nexus (handler global) para evitar "Unknown interaction" em mensagem efêmera */
export const ROTINA_CRIAR_ADD_ITEM_BTN_ID = 'rotina_criar_add_item';
const ROTINA_CRIAR_CONCLUIR_BTN_ID = 'rotina_criar_concluir';

/** Draft em memória por userId (nome, horario, repetir, dias, timezone, items[], messageId, channelId) */
const rotinaCriarDrafts = new Map();

/**
 * Modal principal: Nome, Horário e (se repetir === varios_dias) Dias.
 * Repetir já foi escolhido no dropdown.
 */
function buildRotinaCriarModal(repetir) {
    const isVariosDias = repetir === 'varios_dias';
    const customId = ROTINA_CRIAR_MODAL_PREFIX + repetir;

    const nome = new TextInputBuilder()
        .setCustomId('rotina_criar_nome')
        .setLabel('Nome da rotina')
        .setPlaceholder('Ex: Check-out de Saída')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(100);
    const horario = new TextInputBuilder()
        .setCustomId('rotina_criar_horario')
        .setLabel('Horário')
        .setPlaceholder('HH:MM — ex: 08:00 ou 14:30')
        .setStyle(TextInputStyle.Short)
        .setRequired(true);
    const rows = [
        new ActionRowBuilder().addComponents(nome),
        new ActionRowBuilder().addComponents(horario)
    ];
    if (isVariosDias) {
        const dias = new TextInputBuilder()
            .setCustomId('rotina_criar_dias')
            .setLabel('Quais dias?')
            .setPlaceholder('Ex: segunda, sexta ou segunda, terça, quinta')
            .setStyle(TextInputStyle.Short)
            .setRequired(true);
        rows.push(new ActionRowBuilder().addComponents(dias));
    }
    return new ModalBuilder()
        .setCustomId(customId)
        .setTitle('Nova rotina')
        .addComponents(...rows);
}

/** Modal para adicionar um item à lista (label + condição). Exportado para o Nexus abrir no handler global. */
export function buildRotinaCriarItemModal() {
    const label = new TextInputBuilder()
        .setCustomId('rotina_item_label')
        .setLabel('Nome do item')
        .setPlaceholder('Ex: Fechar a janela')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
        .setMaxLength(200);
    const condition = new TextInputBuilder()
        .setCustomId('rotina_item_condition')
        .setLabel('Condição (opcional)')
        .setPlaceholder('always ou deixe em branco')
        .setStyle(TextInputStyle.Short)
        .setRequired(false);
    return new ModalBuilder()
        .setCustomId(ROTINA_CRIAR_ITEM_MODAL_ID)
        .setTitle('Adicionar item')
        .addComponents(
            new ActionRowBuilder().addComponents(label),
            new ActionRowBuilder().addComponents(condition)
        );
}

/** Normaliza valor de repetir (para slash/fallback) */
function normalizeRepetirValue(input) {
    const v = (input || '').trim().toLowerCase().replace(/\s+/g, '_');
    const byValue = REPETIR_CHOICES.find(c => c.value === v);
    if (byValue) return byValue.value;
    const byName = REPETIR_CHOICES.find(c => c.name.toLowerCase().replace(/\s+/g, '_').includes(v) || v.includes(c.value));
    if (byName) return byName.value;
    if (v.includes(',')) return 'varios_dias';
    return v || 'todo_dia';
}

export const rotinaCriarCommand = {
    data: buildRotinaCriarData(),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild?.id ?? null;
            const name = interaction.options.getString('nome');
            const horario = interaction.options.getString('horario');
            const repetir = interaction.options.getString('repetir');
            const diasOpt = interaction.options.getString('dias');
            const timezoneOpt = interaction.options.getString('timezone');
            const itensStr = interaction.options.getString('itens');

            const useForm = !name && !horario && !repetir;
            if (useForm) {
                const embed = new EmbedBuilder()
                    .setTitle('📝 Criar rotina')
                    .setColor(0x5865F2)
                    .setDescription('Clique no botão e depois escolha **em quais dias** a rotina repete. Em seguida preencha nome e horário no formulário.')
                    .setTimestamp();
                const btn = new ButtonBuilder()
                    .setCustomId(ROTINA_CRIAR_OPEN_FORM_BUTTON_ID)
                    .setLabel('Abrir formulário')
                    .setStyle(ButtonStyle.Primary);
                const row = new ActionRowBuilder().addComponents(btn);
                const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });
                const collector = message.createMessageComponentCollector({
                    filter: (i) => i.user.id === userId,
                    time: 5 * 60 * 1000
                });
                collector.on('collect', async (i) => {
                    try {
                        if (i.isButton() && i.customId === ROTINA_CRIAR_OPEN_FORM_BUTTON_ID) {
                            const embedRepetir = new EmbedBuilder()
                                .setTitle('📅 Em quais dias repete?')
                                .setColor(0x5865F2)
                                .setDescription('Escolha uma opção no menu abaixo. Se for "Vários dias", no próximo passo você informa quais (ex: segunda, sexta).')
                                .setTimestamp();
                            const select = new StringSelectMenuBuilder()
                                .setCustomId(ROTINA_CRIAR_SELECT_REPETIR_ID)
                                .setPlaceholder('Selecione…')
                                .addOptions(REPETIR_CHOICES.map(c => ({ label: c.name, value: c.value })));
                            await i.update({ embeds: [embedRepetir], components: [new ActionRowBuilder().addComponents(select)] });
                        }
                        if (i.isStringSelectMenu() && i.customId === ROTINA_CRIAR_SELECT_REPETIR_ID) {
                            const repetirValue = i.values[0];
                            await i.showModal(buildRotinaCriarModal(repetirValue));
                        }
                    } catch (e) {
                        logger.error('CMD', 'rotina_criar form collect', e.message);
                    }
                });
                return;
            }

            if (!name || !horario || !repetir) {
                await interaction.editReply({
                    content: 'Para criar pela linha de comando, informe **nome**, **horário** e **repetir**. Ou use o comando sem parâmetros e clique em "Abrir formulário".',
                    ephemeral: true
                }).catch(() => {});
                return;
            }

            const locale = interaction.locale || interaction.guildLocale || 'en-GB';
            const savedTimezone = await userPreferenceService.getTimezone(userId);
            const timezone = timezoneOpt || savedTimezone || routineService.getTimezoneFromLocale(locale);
            const items = routineService.parseItemsString(itensStr || '');

            const participantIds = [];
            for (let i = 1; i <= MAX_PARTICIPANT_OPTIONS; i++) {
                const u = interaction.options.getUser(`usuario${i}`);
                if (u?.id && u.id !== userId && !participantIds.includes(u.id)) {
                    participantIds.push(u.id);
                }
            }

            const repetirForCron = repetir === 'varios_dias'
                ? (diasOpt?.trim() || 'segunda, sexta')
                : repetir;
            if (repetir === 'varios_dias' && !diasOpt?.trim()) {
                await interaction.editReply({
                    content: 'Quando escolher **Vários dias**, use o campo `dias` (ex: segunda, sexta ou segunda, terça, quinta, sexta).',
                    ephemeral: true
                }).catch(() => {});
                return;
            }
            const cron = routineService.scheduleToCron(horario, repetirForCron);
            const oneTime = repetir === 'uma_vez';

            const routine = await routineService.createRoutine({
                userId,
                guildId,
                name,
                cron,
                timezone,
                items,
                oneTime,
                participantIds
            });

            if (timezoneOpt) {
                await userPreferenceService.saveTimezone(userId, timezone);
            }

            const repetirLabel = repetir === 'varios_dias'
                ? formatDiasLabel(diasOpt?.trim() || 'segunda, sexta')
                : (REPETIR_CHOICES.find(c => c.value === repetir)?.name ?? repetir);
            const embed = new EmbedBuilder()
                .setTitle('✅ Rotina criada')
                .setColor(0x57F287)
                .addFields(
                    { name: 'Nome', value: routine.name, inline: true },
                    { name: 'Horário', value: horario, inline: true },
                    { name: 'Repetir', value: repetirLabel, inline: true },
                    { name: 'Fuso', value: routine.timezone, inline: true }
                )
                .setTimestamp();

            let footerText = 'Fase 1: agendamento concluído';
            if (timezoneOpt) {
                footerText = `💡 Seu fuso "${timezoneToLabel(timezoneOpt)}" foi salvo nas preferências. Na próxima rotina não será preciso escolher de novo.`;
            }
            embed.setFooter({ text: footerText });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            logger.error('CMD', 'rotina_criar', err.message || String(err), {
                stack: err?.stack,
                rawError: err?.rawError
            });
            await interaction.editReply({
                content: `Erro ao criar rotina: ${err.message}`,
                ephemeral: true
            }).catch(() => {});
        }
    }
};

/**
 * Handler para quando o usuário envia o modal "Nova rotina" (nome + horário [+ dias]).
 * Repetir vem do customId. Cria draft e mostra etapa "Adicionar itens" com botões.
 */
export async function handleRotinaCriarModalSubmit(interaction) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const userId = interaction.user.id;
        const guildId = interaction.guild?.id ?? null;
        const customId = interaction.customId || '';
        const repetir = customId.startsWith(ROTINA_CRIAR_MODAL_PREFIX)
            ? customId.slice(ROTINA_CRIAR_MODAL_PREFIX.length)
            : 'todo_dia';
        const name = (interaction.fields.getTextInputValue('rotina_criar_nome') || '').trim();
        const horario = (interaction.fields.getTextInputValue('rotina_criar_horario') || '').trim();
        const diasOpt = repetir === 'varios_dias'
            ? (interaction.fields.getTextInputValue('rotina_criar_dias') || '').trim()
            : '';

        if (!name || !horario) {
            await interaction.editReply({ content: 'Preencha **Nome** e **Horário**.' }).catch(() => {});
            return;
        }
        if (repetir === 'varios_dias' && !diasOpt) {
            await interaction.editReply({ content: 'Para "Vários dias", preencha o campo **Quais dias?** (ex: segunda, sexta).' }).catch(() => {});
            return;
        }

        const locale = interaction.locale || interaction.guildLocale || 'en-GB';
        const savedTimezone = await userPreferenceService.getTimezone(userId);
        const timezone = savedTimezone || routineService.getTimezoneFromLocale(locale);
        const repetirForCron = repetir === 'varios_dias' ? (diasOpt || 'segunda, sexta') : repetir;
        const repetirLabel = repetir === 'varios_dias'
            ? formatDiasLabel(diasOpt)
            : (REPETIR_CHOICES.find(c => c.value === repetir)?.name ?? repetir);

        const draft = {
            userId,
            guildId,
            name,
            horario,
            repetir,
            diasOpt,
            timezone,
            items: [],
            messageId: null,
            channelId: null
        };
        rotinaCriarDrafts.set(userId, draft);

        const { embed, row } = buildDraftEmbedAndRow(draft);
        const message = await interaction.editReply({ embeds: [embed], components: [row], fetchReply: true });
        draft.messageId = message.id;
        draft.channelId = message.channelId;
        attachConcluirCollector(message, userId);
    } catch (err) {
        logger.error('CMD', 'rotina_criar_modal', err.message || String(err), { stack: err?.stack });
        await interaction.editReply({
            content: `Erro ao criar rotina: ${err.message}`,
            ephemeral: true
        }).catch(() => {});
    }
}

/**
 * Cria collector de "Concluir" numa mensagem do draft (evita duplicar lógica).
 */
function attachConcluirCollector(message, userId) {
    const collector = message.createMessageComponentCollector({
        filter: (i) => i.user.id === userId,
        time: 5 * 60 * 1000
    });
    collector.on('collect', async (i) => {
        try {
            if (i.customId !== ROTINA_CRIAR_CONCLUIR_BTN_ID) return;
            const d = rotinaCriarDrafts.get(userId);
            if (!d) {
                await i.update({ content: 'Este rascunho expirou. Use `/rotina_criar` de novo.', components: [] }).catch(() => {});
                return;
            }
            const cron = routineService.scheduleToCron(d.horario, d.repetir === 'varios_dias' ? (d.diasOpt || 'segunda, sexta') : d.repetir);
            const oneTime = d.repetir === 'uma_vez';
            const routine = await routineService.createRoutine({
                userId: d.userId,
                guildId: d.guildId,
                name: d.name,
                cron,
                timezone: d.timezone,
                items: d.items,
                oneTime,
                participantIds: []
            });
            rotinaCriarDrafts.delete(userId);
            const repetirLabelDone = d.repetir === 'varios_dias' ? formatDiasLabel(d.diasOpt) : (REPETIR_CHOICES.find(c => c.value === d.repetir)?.name ?? d.repetir);
            const doneEmbed = new EmbedBuilder()
                .setTitle('✅ Rotina criada')
                .setColor(0x57F287)
                .addFields(
                    { name: 'Nome', value: routine.name, inline: true },
                    { name: 'Horário', value: d.horario, inline: true },
                    { name: 'Repetir', value: repetirLabelDone, inline: true },
                    { name: 'Fuso', value: routine.timezone, inline: true }
                )
                .setFooter({ text: 'Criada pelo formulário.' })
                .setTimestamp();
            await i.update({ embeds: [doneEmbed], components: [] });
        } catch (e) {
            logger.error('CMD', 'rotina_criar concluir', e.message);
            await i.reply({ content: `Erro: ${e.message}`, ephemeral: true }).catch(() => {});
        }
    });
}

/**
 * Monta embed + row dos botões do draft (reutilizado no modal submit e no item modal submit).
 */
function buildDraftEmbedAndRow(draft) {
    const itemsList = draft.items.length === 0 ? '_Nenhum item ainda._' : draft.items.map((it, i) => `${i + 1}. ${it.label} \`(${it.condition || 'always'})\``).join('\n');
    const repetirLabel = draft.repetir === 'varios_dias' ? formatDiasLabel(draft.diasOpt) : (REPETIR_CHOICES.find(c => c.value === draft.repetir)?.name ?? draft.repetir);
    const embed = new EmbedBuilder()
        .setTitle('📋 Dados da rotina')
        .setColor(0x5865F2)
        .addFields(
            { name: 'Nome', value: draft.name, inline: true },
            { name: 'Horário', value: draft.horario, inline: true },
            { name: 'Repetir', value: repetirLabel, inline: true },
            { name: 'Itens', value: itemsList, inline: false }
        )
        .setFooter({ text: 'Adicione mais itens (opcional) e clique em Concluir.' })
        .setTimestamp();
    const addBtn = new ButtonBuilder().setCustomId(ROTINA_CRIAR_ADD_ITEM_BTN_ID).setLabel('➕ Adicionar item').setStyle(ButtonStyle.Secondary);
    const concluirBtn = new ButtonBuilder().setCustomId(ROTINA_CRIAR_CONCLUIR_BTN_ID).setLabel('✅ Concluir').setStyle(ButtonStyle.Success);
    const row = new ActionRowBuilder().addComponents(addBtn, concluirBtn);
    return { embed, row };
}

/**
 * Handler para quando o usuário envia o modal "Adicionar item".
 * Mensagens efêmeras não podem ser buscadas/editadas (Unknown Message), então
 * respondemos com o painel atualizado e criamos collector na nova mensagem.
 */
export async function handleRotinaCriarItemModalSubmit(interaction) {
    try {
        const userId = interaction.user.id;
        const draft = rotinaCriarDrafts.get(userId);
        if (!draft) {
            await interaction.reply({ content: 'Rascunho expirado. Use `/rotina_criar` e preencha de novo.', ephemeral: true }).catch(() => {});
            return;
        }
        const label = (interaction.fields.getTextInputValue('rotina_item_label') || '').trim();
        const condition = (interaction.fields.getTextInputValue('rotina_item_condition') || '').trim() || 'always';
        if (!label) {
            await interaction.reply({ content: 'Informe o nome do item.', ephemeral: true }).catch(() => {});
            return;
        }
        draft.items.push({ label, condition });
        const { embed, row } = buildDraftEmbedAndRow(draft);
        const message = await interaction.reply({
            content: `✅ Item "${label.slice(0, 50)}${label.length > 50 ? '…' : ''}" adicionado. Abaixo a lista atualizada.`,
            embeds: [embed],
            components: [row],
            ephemeral: true,
            fetchReply: true
        });
        draft.messageId = message.id;
        draft.channelId = message.channelId;
        attachConcluirCollector(message, userId);
    } catch (err) {
        logger.error('CMD', 'rotina_criar_item_modal', err.message || String(err), { stack: err?.stack });
        await interaction.reply({ content: `Erro: ${err.message}`, ephemeral: true }).catch(() => {});
    }
}

const PAGE_SIZE = 5;
const LIST_COLLECTOR_TIME_MS = 5 * 60 * 1000; // 5 min

export const rotinaListarCommand = {
    data: new SlashCommandBuilder()
        .setName('rotina_listar')
        .setDescription('Lista suas rotinas (menu com botões e detalhes)')
        .addStringOption(o => o
            .setName('servidor')
            .setDescription('Filtrar por este servidor apenas (deixe vazio para todas)')
            .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const userId = interaction.user.id;
            const guildId = interaction.options.getString('servidor') || null;
            logger.info('CMD', `rotina_listar invoked by ${userId} (guild filter: ${guildId ?? 'all'})`);
            const routines = await routineService.getRoutinesByUser(userId, guildId);

            if (routines.length === 0) {
                await interaction.editReply({
                    content: 'Você ainda não tem rotinas. Use `/rotina_criar` para criar uma.'
                });
                return;
            }

            const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
            const editPath = (id) => `/routines/${id}/edit?userId=${userId}`;
            const deletePath = (id) => `/routines/${id}/delete?userId=${userId}`;

            const makeBlock = (r, index, isDesativada) => {
                const { horario, repetir } = cronToHuman(r.cron);
                const repetirLabel = r.oneTime ? 'Uma vez só' : repetir;
                const fuso = timezoneToLabel(r.timezone);
                const itens = (r.items || []).length;
                const itensStr = itens === 0 ? 'Nenhum item' : itens === 1 ? '1 item' : `${itens} itens`;
                const isOwner = r.userId === userId;
                const isParticipant = Array.isArray(r.participantIds) && r.participantIds.includes(userId);
                const roleLine = isOwner
                    ? '├ 👤 Dono: você'
                    : (isParticipant ? '├ 👥 Você foi incluído nesta rotina por outro usuário' : null);
                let actionsLine = null;
                if (baseUrl) {
                    if (isOwner) {
                        actionsLine = `└ ✏️ [Editar](${baseUrl}${editPath(r._id)})  ·  🗑️ [Apagar](${baseUrl}${deletePath(r._id)})`;
                    } else if (isParticipant) {
                        const leavePath = `/routines/${r._id}/leave?userId=${userId}`;
                        actionsLine = `└ 🚪 [Sair desta rotina](${baseUrl}${leavePath})`;
                    }
                } else {
                    if (isOwner) {
                        actionsLine = `└ ✏️ \`${editPath(r._id)}\`  ·  🗑️ \`${deletePath(r._id)}\``;
                    } else if (isParticipant) {
                        const leavePath = `/routines/${r._id}/leave?userId=${userId}`;
                        actionsLine = `└ 🚪 \`${leavePath}\``;
                    }
                }
                const title = isDesativada ? `**~~${index}. ${r.name}~~**` : `**${index}. ${r.name}**`;
                return [
                    title,
                    `├ 🕐 ${horario}  ·  ${repetirLabel}`,
                    `├ 🌍 ${fuso}  ·  ${itensStr}`,
                    roleLine,
                    r.oneTime ? '└ ⏰ Uma vez só' : null,
                    r.enabled ? '└ ✅ Ativa' : '└ ❌ Desativada',
                    r.scheduleId ? '└ ⏰ Agendada' : null,
                    actionsLine
                ].filter(Boolean).join('\n');
            };

            const active = routines.filter(r => r.enabled !== false);
            const desativadas = routines.filter(r => r.enabled === false);

            const state = { page: 1, status: 'ativas', view: 'list' };

            function getFiltered() {
                if (state.status === 'ativas') return active;
                if (state.status === 'desativadas') return desativadas;
                return routines;
            }

            function buildListEmbedAndComponents() {
                const filtered = getFiltered();
                const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                const page = Math.min(Math.max(state.page, 1), totalPages);
                const start = (page - 1) * PAGE_SIZE;
                const pageItems = filtered.slice(start, start + PAGE_SIZE);
                const blocks = pageItems.map((r, i) => makeBlock(r, start + i + 1, r.enabled === false));
                const description = blocks.length > 0 ? blocks.join('\n\n') : 'Nenhuma rotina com este filtro.';
                const statusLabel = state.status === 'ativas' ? 'Ativas' : state.status === 'desativadas' ? 'Desativadas' : 'Todas';
                const embed = new EmbedBuilder()
                    .setTitle('📋 Suas rotinas')
                    .setColor(0x5865F2)
                    .setDescription(description)
                    .setFooter({
                        text: `${statusLabel} · Página ${page}/${totalPages} · ${active.length} ativa(s), ${desativadas.length} desativada(s)`
                    })
                    .setTimestamp();

                const prevBtn = new ButtonBuilder()
                    .setCustomId('rotina_listar:prev')
                    .setLabel('◀ Anterior')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page <= 1);
                const nextBtn = new ButtonBuilder()
                    .setCustomId('rotina_listar:next')
                    .setLabel('Próxima ▶')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(page >= totalPages);
                const filterLabel = state.status === 'todas' ? 'Filtro: Todas' : state.status === 'ativas' ? 'Filtro: Ativas' : 'Filtro: Desativadas';
                const filterBtn = new ButtonBuilder()
                    .setCustomId('rotina_listar:filter')
                    .setLabel(filterLabel)
                    .setStyle(ButtonStyle.Primary);
                const row1 = new ActionRowBuilder().addComponents(prevBtn, nextBtn, filterBtn);

                const selectOptions = pageItems.slice(0, 25).map((r) => ({
                    label: (r.name || 'Sem nome').slice(0, 100),
                    value: String(r._id),
                    description: `${r.enabled !== false ? 'Ativa' : 'Desativada'} · ${timezoneToLabel(r.timezone)}`
                }));
                const select = new StringSelectMenuBuilder()
                    .setCustomId('rotina_listar:select')
                    .setPlaceholder('Ver detalhes de uma rotina…')
                    .addOptions(selectOptions.length ? selectOptions : [{ label: '—', value: '_none', description: 'Nenhuma na página' }]);
                const row2 = new ActionRowBuilder().addComponents(select);

                return { embed, components: [row1, row2] };
            }

            function buildDetailEmbed(routineId) {
                const routine = routines.find(r => String(r._id) === routineId);
                if (!routine) return null;
                const { horario, repetir } = cronToHuman(routine.cron);
                const repetirLabel = routine.oneTime ? 'Uma vez só' : repetir;
                const fuso = timezoneToLabel(routine.timezone);
                const itens = (routine.items || []).length;
                const itensList = (routine.items || []).map((item, i) => `${i + 1}. ${item.label} \`(${item.condition || 'always'})\``).join('\n') || '_Nenhum item._';
                const isOwner = routine.userId === userId;
                const isParticipant = Array.isArray(routine.participantIds) && routine.participantIds.includes(userId);
                const lines = [];
                lines.push(`🕐 **Horário:** ${horario} (${repetirLabel})`);
                lines.push(`🌍 **Fuso:** ${fuso}`);
                lines.push(`⚙️ **Uma vez só:** ${routine.oneTime ? 'Sim' : 'Não'}`);
                lines.push(`✅ **Status:** ${routine.enabled ? 'Ativa' : 'Desativada'}`);
                if (routine.scheduleId) lines.push(`⏰ **Agendada:** Sim`);
                if (isOwner) lines.push('👤 **Dono:** você');
                else if (isParticipant) lines.push('👥 **Você foi incluído por outro usuário**');
                if (baseUrl && isOwner) {
                    lines.push(`✏️ [Editar](${baseUrl}${editPath(routine._id)})  ·  🗑️ [Apagar](${baseUrl}${deletePath(routine._id)})`);
                }
                const embed = new EmbedBuilder()
                    .setTitle(`🔍 ${routine.name}`)
                    .setColor(0x5865F2)
                    .setDescription(lines.join('\n'))
                    .addFields({ name: `Itens (${itens})`, value: itensList })
                    .setFooter({ text: 'Clique em "Voltar à lista" para continuar navegando.' })
                    .setTimestamp();
                const backBtn = new ButtonBuilder()
                    .setCustomId('rotina_listar:back')
                    .setLabel('← Voltar à lista')
                    .setStyle(ButtonStyle.Secondary);
                const row = new ActionRowBuilder().addComponents(backBtn);
                return { embed, components: [row] };
            }

            const { embed: firstEmbed, components: firstComponents } = buildListEmbedAndComponents();
            const message = await interaction.editReply({
                embeds: [firstEmbed],
                components: firstComponents,
                fetchReply: true
            });

            const filter = (i) => i.user.id === userId;
            const collector = message.createMessageComponentCollector({ filter, time: LIST_COLLECTOR_TIME_MS });

            collector.on('collect', async (i) => {
                try {
                    if (i.isButton()) {
                        if (i.customId === 'rotina_listar:back') {
                            state.view = 'list';
                            const { embed, components } = buildListEmbedAndComponents();
                            await i.update({ embeds: [embed], components });
                            return;
                        }
                        if (i.customId === 'rotina_listar:prev') {
                            state.page = Math.max(1, state.page - 1);
                            const { embed, components } = buildListEmbedAndComponents();
                            await i.update({ embeds: [embed], components });
                            return;
                        }
                        if (i.customId === 'rotina_listar:next') {
                            const filtered = getFiltered();
                            const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
                            state.page = Math.min(state.page + 1, totalPages);
                            const { embed, components } = buildListEmbedAndComponents();
                            await i.update({ embeds: [embed], components });
                            return;
                        }
                        if (i.customId === 'rotina_listar:filter') {
                            state.page = 1;
                            if (state.status === 'ativas') state.status = 'desativadas';
                            else if (state.status === 'desativadas') state.status = 'todas';
                            else state.status = 'ativas';
                            const { embed, components } = buildListEmbedAndComponents();
                            await i.update({ embeds: [embed], components });
                            return;
                        }
                    }
                    if (i.isStringSelectMenu() && i.customId === 'rotina_listar:select') {
                        const value = i.values[0];
                        if (value === '_none') {
                            await i.deferUpdate();
                            return;
                        }
                        const result = buildDetailEmbed(value);
                        if (result) {
                            await i.update({ embeds: [result.embed], components: result.components });
                        } else {
                            await i.deferUpdate();
                        }
                    }
                } catch (e) {
                    logger.error('CMD', 'rotina_listar collector', e.message);
                    await i.reply({ content: 'Erro ao atualizar. Tente /rotina_listar de novo.', ephemeral: true }).catch(() => {});
                }
            });

            collector.on('end', () => {
                // Opcional: remover botões ao expirar para evitar cliques fantasmas
            });
        } catch (err) {
            logger.error('CMD', 'rotina_listar', err.message || String(err), {
                stack: err?.stack,
                rawError: err?.rawError
            });
            await interaction.editReply({
                content: `Erro ao listar: ${err.message}`,
                ephemeral: true
            }).catch(() => {});
        }
    }
};

/**
 * Opções para o cmdhub deploy (quando o comando for criado pelo front e deployado).
 * Ao alterar os options acima (addStringOption, etc.), esta exportação já reflete — mesma fonte.
 */
export const builtInCommandOptionsForDeploy = {
    rotina_criar: rotinaCriarCommand.data.toJSON().options ?? [],
    rotina_listar: rotinaListarCommand.data.toJSON().options ?? []
};

export default [rotinaCriarCommand, rotinaListarCommand];
