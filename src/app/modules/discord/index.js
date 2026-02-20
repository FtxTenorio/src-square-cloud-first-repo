/**
 * Discord Bot - Square Cloud Bot
 * A smart, fun, and feature-rich Discord bot
 */
import { Client, Collection, Events, GatewayIntentBits, EmbedBuilder, ActivityType } from 'discord.js';
import * as fs from 'fs';
import path from 'node:path';

// Services
import chatHistoryService from './chatHistoryService.js';
import aiService from './services/aiService.js';
import levelService from './services/levelService.js';
import { utilityCommands } from './services/utilityService.js';
import { moderationCommands } from './services/moderationService.js';
import { funCommands } from './services/funService.js';
import { customCommands } from './commands/utility/customCommands.js';
import logger from './services/loggerService.js';

// Initialize Discord client with all necessary intents
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessages
    ]
});

// Command collection
client.commands = new Collection();

/**
 * Register all commands
 */
async function registerCommands() {
    // Register utility commands from file system (ping, server, user)
    const commandsPath = path.join(import.meta.dirname, 'commands/utility');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
        file.endsWith('.js') && !file.includes('customCommands')
    );
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = await (await import(filePath)).default;
            if ('data' in command && 'execute' in command) {
                client.commands.set(command.data.name, command);
            }
        } catch (error) {
            logger.error('DISCORD', `Erro ao carregar comando ${file}`, error.message);
        }
    }
    
    // Register all service commands
    const allCommands = [
        ...utilityCommands,
        ...moderationCommands,
        ...funCommands,
        ...customCommands
    ];
    
    for (const command of allCommands) {
        if ('data' in command && 'execute' in command) {
            client.commands.set(command.data.name, command);
        }
    }
    
    logger.success('DISCORD', `${client.commands.size} comandos registrados`);
}

/**
 * Bot ready event
 */
client.on('ready', async () => {
    logger.discord.ready(client.user.tag, client.guilds.cache.size);
    
    // Set bot activity
    const activities = [
        { name: 'você digitar | /help', type: ActivityType.Watching },
        { name: 'seus comandos | /help', type: ActivityType.Listening },
        { name: 'com os usuários | /help', type: ActivityType.Playing }
    ];
    
    let activityIndex = 0;
    client.user.setActivity(activities[activityIndex].name, { type: activities[activityIndex].type });
    
    // Rotate activity every 5 minutes
    setInterval(() => {
        activityIndex = (activityIndex + 1) % activities.length;
        client.user.setActivity(activities[activityIndex].name, { type: activities[activityIndex].type });
    }, 5 * 60 * 1000);
});

/**
 * Message create event - Main message handler
 */
client.on('messageCreate', async (msg) => {
    // Ignore bots
    if (msg.author.bot) return;
    
    try {
        // Add XP for message
        const xpResult = await levelService.addMessageXP(msg);
        
        // Check for level up
        if (xpResult?.leveledUp) {
            logger.level.levelUp(msg.author.username, xpResult.level);
            
            const levelUpEmbed = new EmbedBuilder()
                .setTitle('🎉 Level Up!')
                .setColor(0xffd700)
                .setDescription(`Parabéns ${msg.author}! Você subiu para o **Nível ${xpResult.level}**!`)
                .setThumbnail(msg.author.displayAvatarURL())
                .setFooter({ text: `+${xpResult.xpGained} XP` });
            
            await msg.channel.send({ embeds: [levelUpEmbed] });
        }
        
        // Check for new badges
        if (xpResult?.newBadges?.length > 0) {
            for (const badge of xpResult.newBadges) {
                logger.level.badge(msg.author.username, `${badge.emoji} ${badge.name}`);
                
                const badgeEmbed = new EmbedBuilder()
                    .setTitle('🏅 Nova Badge Desbloqueada!')
                    .setColor(0xe91e63)
                    .setDescription(`${msg.author} desbloqueou: ${badge.emoji} **${badge.name}**`)
                    .setFooter({ text: badge.description || '' });
                
                await msg.channel.send({ embeds: [badgeEmbed] });
            }
        }
        
        // Save message to history
        await chatHistoryService.saveMessage(msg, 'user');
        
        // Check if bot is mentioned or in DM
        const isMentioned = msg.mentions.has(client.user);
        const isDM = !msg.guild;
        const shouldRespond = isMentioned || isDM;
        
        if (shouldRespond) {
            // Get conversation context
            const context = await chatHistoryService.getContextMessages(
                msg.author.id,
                msg.channel.id,
                10
            );
            
            // Clean message content (remove mention)
            const cleanContent = msg.content
                .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                .trim();
            
            // Generate AI response
            msg.channel.sendTyping();
            
            const startTime = Date.now();
            
            // Create simple message object for AI service
            const messageData = {
                author: msg.author,
                channel: msg.channel,
                content: cleanContent,
                userId: msg.author.id,
                channelId: msg.channel.id
            };
            
            const response = await aiService.generateResponse(messageData, context);
            
            // Send response
            const sentMsg = await msg.reply(response);
            
            // Save bot response
            await chatHistoryService.saveBotResponse({
                guildId: msg.guild?.id,
                channelId: msg.channel.id,
                messageId: sentMsg.id,
                content: response,
                replyToMessageId: msg.id,
                botResponseTime: Date.now() - startTime,
                conversationId: msg.channel.id
            });
        }
    } catch (error) {
        logger.error('DISCORD', `Erro ao processar mensagem`, error.message);
    }
});

/**
 * Interaction create event - Slash command handler
 */
client.on(Events.InteractionCreate, async (interaction) => {
    // Handle button interactions
    if (interaction.isButton()) {
        // Handle joke punchline button
        if (interaction.customId === 'joke_punchline') {
            // Already handled by collector in funService
            return;
        }
        return;
    }
    
    // Handle slash commands
    if (!interaction.isChatInputCommand()) return;
    
    const command = interaction.client.commands.get(interaction.commandName);
    
    if (!command) {
        logger.warn('DISCORD', `Comando não encontrado: "${interaction.commandName}"`);
        return;
    }
    
    try {
        await command.execute(interaction);
        logger.discord.command(interaction.commandName, interaction.user.username, interaction.guild?.name || 'DM');
    } catch (error) {
        logger.error('DISCORD', `Erro ao executar /${interaction.commandName}`, error.message);
        
        const errorMessage = {
            content: '❌ Ocorreu um erro ao executar este comando!',
            ephemeral: true
        };
        
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp(errorMessage);
        } else {
            await interaction.reply(errorMessage);
        }
    }
});

/**
 * Guild member add event - Welcome message
 */
client.on(Events.GuildMemberAdd, async (member) => {
    logger.discord.join(member.user.username, member.guild.name);
    
    // Find welcome channel
    const welcomeChannel = member.guild.channels.cache.find(
        ch => ch.name.includes('welcome') || ch.name.includes('bem-vindo') || ch.name === 'general'
    );
    
    if (welcomeChannel) {
        const embed = new EmbedBuilder()
            .setTitle('👋 Bem-vindo(a)!')
            .setColor(0x2ecc71)
            .setDescription(`${member} acabou de entrar no servidor!`)
            .setThumbnail(member.user.displayAvatarURL())
            .addFields(
                { name: '👤 Usuário', value: member.user.tag, inline: true },
                { name: '📅 Conta criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                { name: '🎯 Membro #', value: `${member.guild.memberCount}`, inline: true }
            )
            .setFooter({ text: 'Use /help para ver os comandos disponíveis!' })
            .setTimestamp();
        
        await welcomeChannel.send({ embeds: [embed] });
    }
});

/**
 * Error handlers
 */
client.on('error', (error) => {
    logger.discord.error(error);
});

process.on('unhandledRejection', (error) => {
    logger.error('SYSTEM', 'Unhandled promise rejection', error.message || error);
});

// Register commands on startup
registerCommands();

export default client;