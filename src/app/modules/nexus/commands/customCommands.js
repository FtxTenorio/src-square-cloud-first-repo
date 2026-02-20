/**
 * Nexus Custom Commands
 * Level, Stats, Personality, Help commands
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import levelService from '../services/levelService.js';
import ai from '../ai/index.js';
import { getPersonalityChoices } from '../ai/personalities.js';
import config from '../core/config.js';

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
        const user = interaction.options.getUser('usuario') || interaction.user;
        const guildId = interaction.guild?.id || 'DM';
        
        const stats = await levelService.getUserStats(user.id, guildId);
        
        if (!stats) {
            return interaction.reply({ 
                content: `${user.username} ainda não tem XP neste servidor.`, 
                ephemeral: true 
            });
        }
        
        await interaction.reply(levelService.formatLevelCard(stats));
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
    }
};

/**
 * Personality command - Change bot personality
 */
export const personalityCommand = {
    data: new SlashCommandBuilder()
        .setName('personality')
        .setDescription('Muda a personalidade do bot para você')
        .addStringOption(option => {
            const opt = option
                .setName('tipo')
                .setDescription('Escolha uma personalidade')
                .setRequired(true);
            
            // Add choices from available personalities
            opt.addChoices(
                { name: '😊 Amigável', value: 'friendly' },
                { name: '💼 Profissional', value: 'professional' },
                { name: '🤣 Engraçado', value: 'funny' },
                { name: '🧙‍♂️ Sábio', value: 'sage' },
                { name: '🏴‍☠️ Pirata', value: 'pirate' },
                { name: '🧝‍♀️ Frieren', value: 'frieren' }
            );
            
            return opt;
        }),
    
    async execute(interaction) {
        const personality = interaction.options.getString('tipo');
        
        ai.setUserPersonality(interaction.user.id, personality);
        const personalities = ai.PERSONALITIES;
        const chosen = personalities[personality];
        
        const embed = new EmbedBuilder()
            .setTitle('🎭 Personalidade Alterada!')
            .setColor(config.colors.fun)
            .setDescription(`Agora vou conversar com você no modo **${chosen.name}** ${chosen.emoji}`)
            .addFields(
                { name: 'Descrição', value: chosen.description || 'Personalidade única!' }
            )
            .setFooter({ text: 'Suas conversas agora terão esse estilo!' });
        
        await interaction.reply({ embeds: [embed] });
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
                    value: '`/personality` `/help` `/ping`',
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
    statsCommand,
    badgesCommand,
    helpCommand,
    pingCommand
];

export default customCommands;
