/**
 * Nexus - Routine Commands (Life-Sync Engine)
 * Slash commands for creating and listing routines.
 * Data is stored in the events module (MongoDB); later: AWS EventBridge + Redis.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
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
    const repetir = dowLabels[dow] ?? dow;
    return { horario, repetir };
}

/** IANA timezone → nome curto para exibição */
function timezoneToLabel(tz) {
    if (!tz) return '—';
    const found = TIMEZONE_CHOICES.find(c => c.value === tz);
    return found ? found.name : tz.split('/').pop()?.replace(/_/g, ' ') ?? tz;
}

export const rotinaCriarCommand = {
    data: new SlashCommandBuilder()
        .setName('rotina_criar')
        .setDescription('Cria uma rotina (checklist no horário que você escolher)')
        .addStringOption(o => o
            .setName('nome')
            .setDescription('Nome da rotina (ex: Check-out de Saída)')
            .setRequired(true))
        .addStringOption(o => o
            .setName('horario')
            .setDescription('Horário (ex: 08:00 ou 8:30)')
            .setRequired(true))
        .addStringOption(o => o
            .setName('repetir')
            .setDescription('Em quais dias repetir')
            .setRequired(true)
            .addChoices(...REPETIR_CHOICES))
        .addStringOption(o => o
            .setName('timezone')
            .setDescription('Seu fuso (opcional; padrão: do seu Discord)')
            .setRequired(false)
            .addChoices(...TIMEZONE_CHOICES))
        .addStringOption(o => o
            .setName('itens')
            .setDescription('Itens: "Coisa a fazer" ou "Coisa|sempre". Vírgula entre cada.')
            .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild?.id ?? null;
            const name = interaction.options.getString('nome');
            const horario = interaction.options.getString('horario');
            const repetir = interaction.options.getString('repetir');
            const timezoneOpt = interaction.options.getString('timezone');
            const locale = interaction.locale || interaction.guildLocale || 'en-GB';
            const savedTimezone = await userPreferenceService.getTimezone(userId);
            const timezone = timezoneOpt || savedTimezone || routineService.getTimezoneFromLocale(locale);
            const itensStr = interaction.options.getString('itens');
            const items = routineService.parseItemsString(itensStr || '');

            const cron = routineService.scheduleToCron(horario, repetir);
            const oneTime = repetir === 'uma_vez';

            const routine = await routineService.createRoutine({
                userId,
                guildId,
                name,
                cron,
                timezone,
                items,
                oneTime
            });

            if (timezoneOpt) {
                await userPreferenceService.saveTimezone(userId, timezone);
            }

            const repetirLabel = REPETIR_CHOICES.find(c => c.value === repetir)?.name ?? repetir;
            const embed = new EmbedBuilder()
                .setTitle('✅ Rotina criada')
                .setColor(0x57F287)
                .addFields(
                    { name: 'Nome', value: routine.name, inline: true },
                    { name: 'Horário', value: horario, inline: true },
                    { name: 'Repetir', value: repetirLabel, inline: true },
                    { name: 'Fuso', value: routine.timezone, inline: true },
                    {
                        name: 'Itens',
                        value: routine.items.length
                            ? routine.items.map(i => `• ${i.label} \`${i.condition}\``).join('\n')
                            : '*Nenhum item*'
                    }
                )
                .setTimestamp();

            let footerText = 'Fase 1: agendamento na nuvem em breve';
            if (timezoneOpt) {
                footerText = '💡 Seu fuso foi salvo nas preferências. Na próxima rotina não será preciso escolher de novo.';
            }
            embed.setFooter({ text: footerText });

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            logger.error('CMD', 'rotina_criar', err.message);
            await interaction.editReply({
                content: `Erro ao criar rotina: ${err.message}`,
                ephemeral: true
            }).catch(() => {});
        }
    }
};

export const rotinaListarCommand = {
    data: new SlashCommandBuilder()
        .setName('rotina_listar')
        .setDescription('Lista suas rotinas')
        .addStringOption(o => o
            .setName('servidor')
            .setDescription('Filtrar por este servidor apenas (deixe vazio para todas)')
            .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const userId = interaction.user.id;
            const guildId = interaction.options.getString('servidor') || null;
            const routines = await routineService.getRoutinesByUser(userId, guildId);

            if (routines.length === 0) {
                await interaction.editReply({
                    content: 'Você ainda não tem rotinas. Use `/rotina_criar` para criar uma.'
                });
                return;
            }

            const active = routines.filter(r => r.enabled !== false);
            const desativadas = routines.filter(r => r.enabled === false);

            const baseUrl = (process.env.PUBLIC_API_URL || '').replace(/\/$/, '');
            const editPath = (id) => `/routines/${id}/edit?userId=${userId}`;
            const deletePath = (id) => `/routines/${id}/delete?userId=${userId}`;
            const makeBlock = (r, index, isDesativada) => {
                const { horario, repetir } = cronToHuman(r.cron);
                const repetirLabel = r.oneTime ? 'Uma vez só' : repetir;
                const fuso = timezoneToLabel(r.timezone);
                const itens = (r.items || []).length;
                const itensStr = itens === 0 ? 'Nenhum item' : itens === 1 ? '1 item' : `${itens} itens`;
                const actionsLine = baseUrl
                    ? `└ ✏️ [Editar](${baseUrl}${editPath(r._id)})  ·  🗑️ [Apagar](${baseUrl}${deletePath(r._id)})`
                    : `└ ✏️ \`${editPath(r._id)}\`  ·  🗑️ \`${deletePath(r._id)}\``;
                const title = isDesativada ? `**~~${index}. ${r.name}~~**` : `**${index}. ${r.name}**`;
                return [
                    title,
                    `├ 🕐 ${horario}  ·  ${repetirLabel}`,
                    `├ 🌍 ${fuso}  ·  ${itensStr}`,
                    actionsLine
                ].join('\n');
            };

            const activeBlocks = active.map((r, i) => makeBlock(r, i + 1, false));
            const desativadasBlocks = desativadas.map((r, i) => makeBlock(r, i + 1, true));

            let description = '';
            if (activeBlocks.length > 0) {
                description += activeBlocks.join('\n\n');
            }
            if (desativadasBlocks.length > 0) {
                if (description) description += '\n\n';
                description += `**━━━ Desativadas ━━━**\n\n` + desativadasBlocks.join('\n\n');
            }

            const embed = new EmbedBuilder()
                .setTitle('📋 Suas rotinas')
                .setColor(0x5865F2)
                .setDescription(description)
                .setFooter({ text: `${active.length} ativa(s), ${desativadas.length} desativada(s) · Do mais antigo ao mais novo` })
                .setTimestamp();

            await interaction.editReply({ embeds: [embed] });
        } catch (err) {
            logger.error('CMD', 'rotina_listar', err.message);
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
