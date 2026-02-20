/**
 * Moderation Commands - Kick, Ban, Mute, Warn, Clear
 */
import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import mongoose from 'mongoose';

// Warning schema for MongoDB
const warningSchema = new mongoose.Schema({
    odId: { type: String, required: true },
    guildId: { type: String, required: true },
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

warningSchema.index({ odId: 1, guildId: 1 });

const Warning = mongoose.models.Warning || mongoose.model('Warning', warningSchema);

// Moderation log schema
const modLogSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    action: { type: String, required: true }, // kick, ban, mute, warn, clear
    targetId: { type: String },
    targetUsername: { type: String },
    moderatorId: { type: String, required: true },
    moderatorUsername: { type: String },
    reason: { type: String },
    duration: { type: Number }, // For mutes, in seconds
    messagesDeleted: { type: Number }, // For clear command
    createdAt: { type: Date, default: Date.now }
});

const ModLog = mongoose.models.ModLog || mongoose.model('ModLog', modLogSchema);

/**
 * Log moderation action
 */
async function logModerationAction(data) {
    try {
        await ModLog.create(data);
    } catch (e) {
        console.error('Failed to log moderation action:', e);
    }
}

/**
 * Kick command
 */
export const kickCommand = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Expulsa um membro do servidor')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para expulsar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo da expulsão')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Sem motivo especificado';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ Usuário não encontrado no servidor.', ephemeral: true });
        }
        
        if (!member.kickable) {
            return interaction.reply({ content: '❌ Não posso expulsar este usuário.', ephemeral: true });
        }
        
        if (member.roles.highest.position >= interaction.member.roles.highest.position) {
            return interaction.reply({ content: '❌ Você não pode expulsar alguém com cargo igual ou superior.', ephemeral: true });
        }
        
        try {
            // Try to DM the user
            await user.send(`Você foi expulso do servidor **${interaction.guild.name}**\nMotivo: ${reason}`).catch(() => {});
            
            await member.kick(reason);
            
            await logModerationAction({
                guildId: interaction.guild.id,
                action: 'kick',
                targetId: user.id,
                targetUsername: user.username,
                moderatorId: interaction.user.id,
                moderatorUsername: interaction.user.username,
                reason
            });
            
            const embed = new EmbedBuilder()
                .setTitle('👢 Usuário Expulso')
                .setColor(0xe67e22)
                .addFields(
                    { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderador', value: interaction.user.tag, inline: true },
                    { name: 'Motivo', value: reason }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: `❌ Erro ao expulsar: ${error.message}`, ephemeral: true });
        }
    }
};

/**
 * Ban command
 */
export const banCommand = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Bane um membro do servidor')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para banir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do ban')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('deletar_mensagens')
                .setDescription('Deletar mensagens dos últimos X dias (0-7)')
                .setMinValue(0)
                .setMaxValue(7)
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo') || 'Sem motivo especificado';
        const deleteMessages = interaction.options.getInteger('deletar_mensagens') || 0;
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (member) {
            if (!member.bannable) {
                return interaction.reply({ content: '❌ Não posso banir este usuário.', ephemeral: true });
            }
            
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({ content: '❌ Você não pode banir alguém com cargo igual ou superior.', ephemeral: true });
            }
        }
        
        try {
            await user.send(`Você foi banido do servidor **${interaction.guild.name}**\nMotivo: ${reason}`).catch(() => {});
            
            await interaction.guild.members.ban(user.id, { 
                reason, 
                deleteMessageSeconds: deleteMessages * 86400 
            });
            
            await logModerationAction({
                guildId: interaction.guild.id,
                action: 'ban',
                targetId: user.id,
                targetUsername: user.username,
                moderatorId: interaction.user.id,
                moderatorUsername: interaction.user.username,
                reason
            });
            
            const embed = new EmbedBuilder()
                .setTitle('🔨 Usuário Banido')
                .setColor(0xe74c3c)
                .addFields(
                    { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderador', value: interaction.user.tag, inline: true },
                    { name: 'Motivo', value: reason },
                    { name: 'Mensagens deletadas', value: `${deleteMessages} dia(s)` }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: `❌ Erro ao banir: ${error.message}`, ephemeral: true });
        }
    }
};

/**
 * Timeout/Mute command
 */
export const timeoutCommand = {
    data: new SlashCommandBuilder()
        .setName('timeout')
        .setDescription('Silencia um membro temporariamente')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para silenciar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('duracao')
                .setDescription('Duração (ex: 5m, 1h, 1d)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do silenciamento')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const durationStr = interaction.options.getString('duracao');
        const reason = interaction.options.getString('motivo') || 'Sem motivo especificado';
        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        
        if (!member) {
            return interaction.reply({ content: '❌ Usuário não encontrado no servidor.', ephemeral: true });
        }
        
        if (!member.moderatable) {
            return interaction.reply({ content: '❌ Não posso silenciar este usuário.', ephemeral: true });
        }
        
        // Parse duration
        const timeRegex = /(\d+)([mhd])/gi;
        let totalMs = 0;
        let match;
        
        while ((match = timeRegex.exec(durationStr)) !== null) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            
            switch (unit) {
                case 'm': totalMs += value * 60000; break;
                case 'h': totalMs += value * 3600000; break;
                case 'd': totalMs += value * 86400000; break;
            }
        }
        
        if (totalMs === 0) {
            return interaction.reply({ content: '❌ Duração inválida. Use formato como: 5m, 1h, 1d', ephemeral: true });
        }
        
        // Max timeout is 28 days
        if (totalMs > 28 * 86400000) {
            return interaction.reply({ content: '❌ Duração máxima é 28 dias.', ephemeral: true });
        }
        
        try {
            await member.timeout(totalMs, reason);
            
            await logModerationAction({
                guildId: interaction.guild.id,
                action: 'timeout',
                targetId: user.id,
                targetUsername: user.username,
                moderatorId: interaction.user.id,
                moderatorUsername: interaction.user.username,
                reason,
                duration: totalMs / 1000
            });
            
            const endTime = Math.floor((Date.now() + totalMs) / 1000);
            
            const embed = new EmbedBuilder()
                .setTitle('🔇 Usuário Silenciado')
                .setColor(0x9b59b6)
                .addFields(
                    { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderador', value: interaction.user.tag, inline: true },
                    { name: 'Duração', value: durationStr },
                    { name: 'Termina em', value: `<t:${endTime}:R>` },
                    { name: 'Motivo', value: reason }
                )
                .setTimestamp();
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({ content: `❌ Erro ao silenciar: ${error.message}`, ephemeral: true });
        }
    }
};

/**
 * Warn command
 */
export const warnCommand = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Adiciona um aviso ao usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para avisar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('motivo')
                .setDescription('Motivo do aviso')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const reason = interaction.options.getString('motivo');
        
        try {
            await Warning.create({
                odId: user.id,
                guildId: interaction.guild.id,
                moderatorId: interaction.user.id,
                reason
            });
            
            const warnings = await Warning.countDocuments({ 
                odId: user.id, 
                guildId: interaction.guild.id 
            });
            
            await logModerationAction({
                guildId: interaction.guild.id,
                action: 'warn',
                targetId: user.id,
                targetUsername: user.username,
                moderatorId: interaction.user.id,
                moderatorUsername: interaction.user.username,
                reason
            });
            
            // Notify user
            await user.send(`⚠️ Você recebeu um aviso no servidor **${interaction.guild.name}**\nMotivo: ${reason}\nVocê agora tem ${warnings} aviso(s).`).catch(() => {});
            
            const embed = new EmbedBuilder()
                .setTitle('⚠️ Aviso Aplicado')
                .setColor(0xf1c40f)
                .addFields(
                    { name: 'Usuário', value: `${user.tag} (${user.id})`, inline: true },
                    { name: 'Moderador', value: interaction.user.tag, inline: true },
                    { name: 'Total de Avisos', value: `${warnings}`, inline: true },
                    { name: 'Motivo', value: reason }
                )
                .setTimestamp();
            
            // Auto-actions based on warnings
            let autoAction = null;
            if (warnings === 3) {
                autoAction = '⚠️ **Atenção:** Este usuário tem 3 avisos. Considere aplicar um timeout.';
            } else if (warnings >= 5) {
                autoAction = '🚨 **Alerta:** Este usuário tem 5+ avisos. Considere um ban.';
            }
            
            await interaction.reply({ 
                content: autoAction, 
                embeds: [embed] 
            });
        } catch (error) {
            await interaction.reply({ content: `❌ Erro ao avisar: ${error.message}`, ephemeral: true });
        }
    }
};

/**
 * Warnings list command
 */
export const warningsCommand = {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('Lista os avisos de um usuário')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Usuário para verificar')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        
        const warnings = await Warning.find({ 
            odId: user.id, 
            guildId: interaction.guild.id 
        }).sort({ createdAt: -1 }).limit(10);
        
        if (warnings.length === 0) {
            return interaction.reply({ content: `✅ ${user.tag} não tem avisos.`, ephemeral: true });
        }
        
        const warningsList = warnings.map((w, i) => 
            `**${i + 1}.** ${w.reason}\n   <t:${Math.floor(w.createdAt.getTime() / 1000)}:R> por <@${w.moderatorId}>`
        ).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setTitle(`⚠️ Avisos de ${user.tag}`)
            .setColor(0xf1c40f)
            .setDescription(warningsList)
            .setFooter({ text: `Total: ${warnings.length} aviso(s)` })
            .setThumbnail(user.displayAvatarURL());
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Clear messages command
 */
export const clearCommand = {
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Limpa mensagens do canal')
        .addIntegerOption(option =>
            option.setName('quantidade')
                .setDescription('Quantidade de mensagens (1-100)')
                .setMinValue(1)
                .setMaxValue(100)
                .setRequired(true))
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Limpar apenas mensagens deste usuário')
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages),
    
    async execute(interaction) {
        const amount = interaction.options.getInteger('quantidade');
        const user = interaction.options.getUser('usuario');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            let messages = await interaction.channel.messages.fetch({ limit: amount });
            
            if (user) {
                messages = messages.filter(m => m.author.id === user.id);
            }
            
            // Filter messages older than 14 days (Discord limitation)
            const twoWeeksAgo = Date.now() - 14 * 86400000;
            messages = messages.filter(m => m.createdTimestamp > twoWeeksAgo);
            
            const deleted = await interaction.channel.bulkDelete(messages, true);
            
            await logModerationAction({
                guildId: interaction.guild.id,
                action: 'clear',
                moderatorId: interaction.user.id,
                moderatorUsername: interaction.user.username,
                messagesDeleted: deleted.size,
                reason: user ? `Mensagens de ${user.tag}` : 'Limpeza geral'
            });
            
            await interaction.editReply(`🗑️ ${deleted.size} mensagens deletadas${user ? ` de ${user.tag}` : ''}.`);
        } catch (error) {
            await interaction.editReply(`❌ Erro ao limpar: ${error.message}`);
        }
    }
};

/**
 * Moderation logs command
 */
export const modlogsCommand = {
    data: new SlashCommandBuilder()
        .setName('modlogs')
        .setDescription('Mostra logs de moderação')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Filtrar por usuário')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('acao')
                .setDescription('Filtrar por tipo de ação')
                .addChoices(
                    { name: 'Kick', value: 'kick' },
                    { name: 'Ban', value: 'ban' },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Warn', value: 'warn' },
                    { name: 'Clear', value: 'clear' }
                )
                .setRequired(false))
        .setDefaultMemberPermissions(PermissionFlagsBits.ViewAuditLog),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        const action = interaction.options.getString('acao');
        
        const filter = { guildId: interaction.guild.id };
        if (user) filter.targetId = user.id;
        if (action) filter.action = action;
        
        const logs = await ModLog.find(filter)
            .sort({ createdAt: -1 })
            .limit(15);
        
        if (logs.length === 0) {
            return interaction.reply({ content: '📝 Nenhum log encontrado.', ephemeral: true });
        }
        
        const actionEmojis = { kick: '👢', ban: '🔨', timeout: '🔇', warn: '⚠️', clear: '🗑️' };
        
        const logsList = logs.map((log, i) => {
            const emoji = actionEmojis[log.action] || '📋';
            const target = log.targetUsername ? `**${log.targetUsername}**` : 'N/A';
            const time = `<t:${Math.floor(log.createdAt.getTime() / 1000)}:R>`;
            return `${emoji} **${log.action.toUpperCase()}** - ${target}\n   Por: ${log.moderatorUsername} ${time}`;
        }).join('\n\n');
        
        const embed = new EmbedBuilder()
            .setTitle('📋 Logs de Moderação')
            .setColor(0x3498db)
            .setDescription(logsList)
            .setFooter({ text: `Mostrando ${logs.length} logs mais recentes` });
        
        await interaction.reply({ embeds: [embed], ephemeral: true });
    }
};

export const moderationCommands = [
    kickCommand,
    banCommand,
    timeoutCommand,
    warnCommand,
    warningsCommand,
    clearCommand,
    modlogsCommand
];

export default moderationCommands;
