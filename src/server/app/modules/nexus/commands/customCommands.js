/**
 * Nexus Custom Commands
 * Level, Stats, Personality, Help commands
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import levelService from '../services/levelService.js';
import ai from '../ai/index.js';
import config from '../core/config.js';
import logger from '../utils/logger.js';

/**
 * Level command - Show user's level
 */
export const levelCommand = {
    data: new SlashCommandBuilder()
        .setName('level')
        .setDescription('Mostra seu nível atual')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver nível de outro usuário')
                .setRequired(false)),
    
    async execute(interaction) {
        try {
            const user = interaction.options.getUser('usuario') || interaction.user;
            const guildId = interaction.guild?.id || 'DM';
            const stats = await levelService.getUserStats(user.id, guildId);
            if (!stats) {
                return interaction.reply({ content: `${user.username} ainda não tem XP neste servidor.`, ephemeral: true });
            }
            await interaction.reply(levelService.formatLevelCard(stats));
        } catch (err) {
            logger.error('CMD', 'Erro no comando /level', err.message);
            await interaction.reply({ content: 'Não foi possível carregar o nível. Tente novamente.', ephemeral: true }).catch(() => {});
        }
    }
};

/**
 * Leaderboard command
 */
export const leaderboardCommand = {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Mostra o ranking do servidor'),
    
    async execute(interaction) {
        try {
            const guildId = interaction.guild?.id || 'DM';
            const leaderboard = await levelService.getLeaderboard(guildId, 10);
            if (leaderboard.length === 0) {
                return interaction.reply('Ninguém tem XP ainda! Comece a conversar para ganhar pontos.');
            }
            const medals = ['🥇', '🥈', '🥉'];
        const list = leaderboard.map((user, i) => {
            const medal = medals[i] || `**${i + 1}.**`;
            return `${medal} **${user.username}** - Nível ${user.level} (${user.xp} XP)`;
        }).join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`🏆 Ranking - ${interaction.guild?.name || 'Servidor'}`)
            .setColor(config.colors.xp)
            .setDescription(list)
            .setFooter({ text: 'Top 10 usuários mais ativos' })
            .setTimestamp();
            await interaction.reply({ embeds: [embed] });
        } catch (err) {
            logger.error('CMD', 'Erro no comando /leaderboard', err.message);
            await interaction.reply({ content: 'Não foi possível carregar o ranking.', ephemeral: true }).catch(() => {});
        }
    }
};

/**
 * Personality command - Muda a personalidade do bot neste canal (por chat)
 */
export const personalityCommand = {
    data: new SlashCommandBuilder()
        .setName('personality')
        .setDescription('Muda a personalidade do bot neste canal')
        .addStringOption(option => {
            const opt = option
                .setName('tipo')
                .setDescription('Escolha uma personalidade para este canal')
                .setRequired(true);
            
            opt.addChoices(
                { name: '😊 Amigável', value: 'friendly' },
                { name: '💼 Profissional', value: 'professional' },
                { name: '🧙‍♀️ Sábia', value: 'sage' },
                { name: '🤣 Divertido', value: 'divertido' },
                { name: '🔍 Analista', value: 'analista' }
            );
            return opt;
        }),
    
    async execute(interaction) {
        const personalityId = interaction.options.getString('tipo');
        const channelId = interaction.channelId;
        const guildId = interaction.guild?.id ?? 'DM';
        const guildName = interaction.guild?.name ?? 'DM';
        
        logger.info('CMD', `personality: canal ${channelId} → ${personalityId} por ${interaction.user.username} (${guildName})`);
        
        await ai.setChatPersonality(channelId, personalityId, guildId);
        const chosen = await ai.getChatPersonality(channelId, guildId);
        const display = chosen || { name: personalityId, emoji: '🎭', description: '' };
        
        const embed = new EmbedBuilder()
            .setTitle('🎭 Personalidade do canal alterada!')
            .setColor(config.colors.fun)
            .setDescription(`Este canal agora usa **${display.name}** ${display.emoji || ''}`)
            .addFields(
                { name: 'Descrição', value: display.description || 'Personalidade única!' }
            )
            .setFooter({ text: 'O humor temporário (ex: brava após "velha" 3x) pode sobrescrever momentaneamente.' });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Humor command - Show or set current channel mood
 */
export const humorCommand = {
    data: new SlashCommandBuilder()
        .setName('humor')
        .setDescription('Mostra ou altera o humor da Frieren neste canal')
        .addStringOption(option =>
            option
                .setName('definir')
                .setDescription('Escolha um humor para definir no canal (opcional)')
                .setRequired(false)
                .addChoices(
                    { name: '😊 Amigável', value: 'friendly' },
                    { name: '🧙‍♀️ Sábia', value: 'sage' },
                    { name: '😤 Brava', value: 'brava' },
                    { name: '😭 Chorona', value: 'chorona' }
                )),
    
    async execute(interaction) {
        const channelId = interaction.channelId;
        const guildId = interaction.guild?.id ?? null;
        const definir = interaction.options.getString('definir');
        
        if (definir) {
            await ai.setChannelMood(channelId, definir, guildId);
            logger.info('CMD', `humor: canal ${channelId} definido para ${definir} por ${interaction.user.username} (guild=${guildId ?? 'null'})`);
            const moodLabels = { friendly: '😊 Amigável', sage: '🧙‍♀️ Sábia', brava: '😤 Brava', chorona: '😭 Chorona' };
            const moodInfo = moodLabels[definir] || definir;
            const embed = new EmbedBuilder()
                .setTitle('🎭 Humor alterado')
                .setColor(config.colors.fun)
                .setDescription(`O humor deste canal foi definido para **${moodInfo}**.`)
                .setFooter({ text: 'Use /humor sem parâmetro para ver o humor atual' })
                .setTimestamp();
            await interaction.reply({ embeds: [embed] });
            return;
        }
        
        const mood = await ai.getChannelMood(channelId);
        const chatPersonality = await ai.getChatPersonality(channelId, guildId || 'DM');
        const moodLabels = { friendly: '😊 Amigável', sage: '🧙‍♀️ Sábia', brava: '😤 Brava', chorona: '😭 Chorona' };
        const moodLabel = moodLabels[mood] || mood;
        const personalityLabel = chatPersonality ? `${chatPersonality.emoji || ''} ${chatPersonality.name}` : '—';
        
        const description = [
            `**Humor atual:** ${moodLabel}`,
            `**Personalidade do canal:** ${personalityLabel}`,
            '',
            '_O humor é temporário (ex: brava após "velha" 3x). A personalidade é o padrão do canal._'
        ].join('\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🎭 Humor e personalidade')
            .setColor(config.colors.fun)
            .setDescription(description)
            .setFooter({ text: 'Use /humor definir: para mudar o humor · /personality para mudar a personalidade' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

/**
 * Stats command - Show user stats
 */
export const statsCommand = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Mostra suas estatísticas completas')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Ver stats de outro usuário')
                .setRequired(false)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const guildId = interaction.guild?.id || 'DM';
        
        const stats = await levelService.getUserStats(user.id, guildId);
        
        if (!stats) {
            return interaction.reply({ 
                content: `${user.username} ainda não tem estatísticas.`, 
                ephemeral: true 
            });
        }
        
        const badgesList = stats.badges.length > 0 
            ? stats.badges.map(b => `${b.emoji} **${b.name}**`).join('\n')
            : 'Nenhuma badge ainda';
        
        const embed = new EmbedBuilder()
            .setTitle(`📊 Estatísticas de ${stats.username}`)
            .setColor(config.colors.info)
            .setThumbnail(user.displayAvatarURL())
            .addFields(
                { name: '🎯 Nível', value: `${stats.level}`, inline: true },
                { name: '⭐ XP Total', value: `${stats.xp}`, inline: true },
                { name: '🏆 Rank', value: `#${stats.rank}`, inline: true },
                { name: '💬 Mensagens', value: `${stats.totalMessages}`, inline: true },
                { name: '🔥 Streak Atual', value: `${stats.streak.current} dias`, inline: true },
                { name: '📈 Maior Streak', value: `${stats.streak.longest} dias`, inline: true },
                { name: '🏅 Badges', value: badgesList }
            )
            .setFooter({ text: `Progresso: ${stats.progress}% para próximo nível` });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Badges command - Show all badges
 */
export const badgesCommand = {
    data: new SlashCommandBuilder()
        .setName('badges')
        .setDescription('Lista todas as badges disponíveis'),
    
    async execute(interaction) {
        const allBadges = Object.values(levelService.BADGES);
        
        const list = allBadges.map(b => 
            `${b.emoji} **${b.name}**\n   └ _${b.description}_`
        ).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setTitle('🏅 Badges Disponíveis')
            .setColor(config.colors.xp)
            .setDescription(list)
            .setFooter({ text: 'Continue ativo para desbloquear!' });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Help command - Show all commands
 */
export const helpCommand = {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription('Mostra todos os comandos disponíveis'),
    
    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('📚 Comandos Nexus')
            .setColor(config.colors.primary)
            .setDescription('Aqui estão todos os comandos disponíveis:')
            .addFields(
                { 
                    name: '🎮 Diversão', 
                    value: '`/8ball` `/roll` `/joke` `/meme` `/rps` `/compliment` `/roast` `/choose` `/rate` `/ship`',
                    inline: false
                },
                { 
                    name: '🛠️ Utilidades', 
                    value: '`/weather` `/translate` `/poll` `/remind` `/calc` `/coin`',
                    inline: false
                },
                { 
                    name: '📊 Níveis & XP', 
                    value: '`/level` `/stats` `/leaderboard` `/badges`',
                    inline: false
                },
                { 
                    name: '🤖 Bot', 
                    value: '`/personality` `/humor` `/help` `/ping`',
                    inline: false
                },
                { 
                    name: '🛡️ Moderação', 
                    value: '`/kick` `/ban` `/timeout` `/warn` `/warnings` `/clear` `/modlogs`',
                    inline: false
                }
            )
            .setFooter({ text: 'Nexus • Você também pode conversar comigo diretamente!' })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Ping command
 */
export const pingCommand = {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription('Verifica a latência do bot'),
    
    async execute(interaction) {
        const sent = await interaction.reply({ content: '🏓 Pinging...', fetchReply: true });
        const latency = sent.createdTimestamp - interaction.createdTimestamp;
        const apiLatency = Math.round(interaction.client.ws.ping);
        logger.debug('CMD', `ping: ${latency}ms (API: ${apiLatency}ms)`);
        
        const embed = new EmbedBuilder()
            .setTitle('🏓 Pong!')
            .setColor(latency < 200 ? config.colors.success : config.colors.warning)
            .addFields(
                { name: '📡 Latência', value: `${latency}ms`, inline: true },
                { name: '🌐 API', value: `${apiLatency}ms`, inline: true }
            )
            .setTimestamp();
        
        await interaction.editReply({ content: null, embeds: [embed] });
    }
};

// Export all custom commands
export const customCommands = [
    levelCommand,
    leaderboardCommand,
    personalityCommand,
    humorCommand,
    statsCommand,
    badgesCommand,
    helpCommand,
    pingCommand
];

/**
 * Opções no formato da API do Discord para o cmdhub deploy.
 * Ao criar ou alterar um comando com opções (addStringOption, addUserOption, etc.) aqui em cima,
 * esta exportação garante que o deploy use as mesmas opções — configure os dois ao mesmo tempo.
 * Fonte única: os SlashCommandBuilder dos comandos acima.
 */
export const builtInCommandOptionsForDeploy = {
    humor: humorCommand.data.toJSON().options ?? [],
    personality: personalityCommand.data.toJSON().options ?? []
};

export default customCommands;
