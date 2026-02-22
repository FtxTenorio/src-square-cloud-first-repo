/**
 * Nexus - Routine Commands (Life-Sync Engine)
 * Slash commands for creating and listing routines.
 * Data is stored in the events module (MongoDB); later: AWS EventBridge + Redis.
 */

import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import * as routineService from '../../events/services/routineService.js';
import logger from '../utils/logger.js';

const TIMEZONE_CHOICES = [
    { name: 'Europe/London', value: 'Europe/London' },
    { name: 'America/Sao_Paulo', value: 'America/Sao_Paulo' },
    { name: 'America/New_York', value: 'America/New_York' },
    { name: 'Europe/Paris', value: 'Europe/Paris' },
    { name: 'UTC', value: 'UTC' }
];

export const rotinaCriarCommand = {
    data: new SlashCommandBuilder()
        .setName('rotina_criar')
        .setDescription('Cria uma nova rotina (checklist agendada)')
        .addStringOption(o => o
            .setName('nome')
            .setDescription('Nome da rotina (ex: Check-out de Saída)')
            .setRequired(true))
        .addStringOption(o => o
            .setName('cron')
            .setDescription('Expressão cron (ex: 0 8 * * 1-5 = 08:00 seg-sex)')
            .setRequired(true))
        .addStringOption(o => o
            .setName('timezone')
            .setDescription('Fuso horário')
            .setRequired(true)
            .addChoices(...TIMEZONE_CHOICES))
        .addStringOption(o => o
            .setName('itens')
            .setDescription('Itens do checklist: "Label|condição" separados por vírgula ou linha. Ex: Chave e Carteira|always, Guarda-chuva|weather.rain>20')
            .setRequired(false)),
    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });
        try {
            const userId = interaction.user.id;
            const guildId = interaction.guild?.id ?? null;
            const name = interaction.options.getString('nome');
            const cron = interaction.options.getString('cron');
            const timezone = interaction.options.getString('timezone') || 'Europe/London';
            const itensStr = interaction.options.getString('itens');
            const items = routineService.parseItemsString(itensStr || '');

            const routine = await routineService.createRoutine({
                userId,
                guildId,
                name,
                cron,
                timezone,
                items
            });

            const embed = new EmbedBuilder()
                .setTitle('✅ Rotina criada')
                .setColor(0x57F287)
                .addFields(
                    { name: 'Nome', value: routine.name, inline: true },
                    { name: 'Cron', value: `\`${routine.cron}\``, inline: true },
                    { name: 'Timezone', value: routine.timezone, inline: true },
                    {
                        name: 'Itens',
                        value: routine.items.length
                            ? routine.items.map(i => `• ${i.label} \`${i.condition}\``).join('\n')
                            : '*Nenhum item*'
                    }
                )
                .setFooter({ text: `ID: ${routine._id} • Fase 1: agendamento na nuvem em breve` })
                .setTimestamp();

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

            const embed = new EmbedBuilder()
                .setTitle('📋 Suas rotinas')
                .setColor(0x5865F2)
                .setDescription(routines.map((r, i) => {
                    const itens = (r.items || []).length;
                    return `**${i + 1}. ${r.name}** — \`${r.cron}\` ${r.timezone} (${itens} itens)`;
                }).join('\n'))
                .setFooter({ text: `${routines.length} rotina(s)` })
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
