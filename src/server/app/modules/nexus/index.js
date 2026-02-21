/**
 * Nexus - Discord Bot Module
 * A modular, intelligent Discord bot framework
 * 
 * @module nexus
 * @version 2.0.0
 */

import { Events, ActivityType, EmbedBuilder } from 'discord.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Core
import { createClient, login, shutdown } from './core/client.js';
import config from './core/config.js';
import { loadCommands, loadEvents, loadServiceCommands } from './core/loader.js';

// AI
import ai from './ai/index.js';

// Utils
import logger from './utils/logger.js';

// External modules
import cmdhub from '../cmdhub/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Module state
let client = null;
let isInitialized = false;

// Store status messages per channel (for velha counter)
const velhaStatusMessages = new Map();

/**
 * Update or create the velha counter status message in a channel
 */
async function updateVelhaStatus(channel, count) {
    try {
        const statusEmojis = ['', '😐', '😠', '😭'];
        const statusTexts = [
            '',
            '`⚠️ Paciência: ██████████░░░░░ (1/3)` 😐',
            '`⚠️ Paciência: █████░░░░░░░░░░ (2/3)` 😠',
            '`💔 Paciência: ░░░░░░░░░░░░░░░ (3/3)` 😭'
        ];
        
        const existingMsgId = velhaStatusMessages.get(channel.id);
        
        if (count === 0) {
            // Delete status message if counter reset
            if (existingMsgId) {
                try {
                    const msg = await channel.messages.fetch(existingMsgId);
                    await msg.delete();
                } catch (e) { /* message already deleted */ }
                velhaStatusMessages.delete(channel.id);
            }
            return;
        }
        
        const statusText = statusTexts[count] || statusTexts[1];
        
        if (existingMsgId) {
            // Try to edit existing message
            try {
                const msg = await channel.messages.fetch(existingMsgId);
                await msg.edit(statusText);
                return;
            } catch (e) {
                // Message was deleted, create new one
                velhaStatusMessages.delete(channel.id);
            }
        }
        
        // Create new status message
        const newMsg = await channel.send(statusText);
        velhaStatusMessages.set(channel.id, newMsg.id);
        
    } catch (error) {
        logger.debug('NEXUS', `Erro ao atualizar status velha: ${error.message}`);
    }
}

/**
 * Initialize Nexus
 * @param {object} options - Initialization options
 */
export async function init(options = {}) {
    if (isInitialized) {
        logger.warn('NEXUS', 'Nexus já foi inicializado');
        return client;
    }
    
    logger.banner(config.name, config.version);
    logger.system.start();
    
    // Create Discord client
    client = createClient();
    
    // Load commands from services (fun, utility, moderation, etc)
    const servicesPath = options.servicesPath || path.join(__dirname, 'services');
    await loadServiceCommands(client, servicesPath);
    
    // Load custom commands
    const commandsPath = options.commandsPath || path.join(__dirname, 'commands');
    await loadCommands(client, commandsPath);
    
    // Load events
    const eventsPath = options.eventsPath || path.join(__dirname, 'events');
    await loadEvents(client, eventsPath);
    
    // Setup core event handlers
    setupCoreEvents(client, options);
    
    isInitialized = true;
    
    return client;
}

/**
 * Start the bot (connect to Discord)
 */
export async function start(token) {
    if (!client) {
        throw new Error('Nexus não foi inicializado. Chame init() primeiro.');
    }
    
    const discordToken = token || process.env.DISCORD_SECRET_KEY;
    await login(client, discordToken);
    
    return client;
}

/**
 * Setup core event handlers
 */
function setupCoreEvents(client, options) {
    // Ready event
    client.on(Events.ClientReady, async () => {
        logger.discord.ready(client.user.tag, client.guilds.cache.size);
        
        // Set cmdhub application ID for Discord API calls
        cmdhub.commandService.setApplicationId(client.application.id);
        
        // Set activity rotation
        const activities = config.discord.activities;
        let activityIndex = 0;
        
        const setActivity = () => {
            const activity = activities[activityIndex];
            client.user.setActivity(activity.name, { 
                type: ActivityType[activity.type] || ActivityType.Playing 
            });
            activityIndex = (activityIndex + 1) % activities.length;
        };
        
        setActivity();
        setInterval(setActivity, config.discord.activityRotation);
        
        logger.system.ready();
        logger.divider('NEXUS ONLINE');
    });
    
    // Message handler
    client.on(Events.MessageCreate, async (message) => {
        // Debug log
        logger.debug('MSG', `Mensagem de ${message.author.tag}: ${message.content.substring(0, 50)}`);
        
        if (message.author.bot) return;
        
        try {
            // XP handling (if levelService is provided)
            if (options.levelService) {
                const xpResult = await options.levelService.addMessageXP(message);
                
                if (xpResult?.leveledUp) {
                    logger.level.levelUp(message.author.username, xpResult.level);
                    
                    const embed = new EmbedBuilder()
                        .setTitle('🎉 Level Up!')
                        .setColor(config.colors.xp)
                        .setDescription(`Parabéns ${message.author}! Você subiu para o **Nível ${xpResult.level}**!`)
                        .setThumbnail(message.author.displayAvatarURL())
                        .setFooter({ text: `+${xpResult.xpGained} XP` });
                    
                    await message.channel.send({ embeds: [embed] });
                }
                
                if (xpResult?.newBadges?.length > 0) {
                    for (const badge of xpResult.newBadges) {
                        logger.level.badge(message.author.username, `${badge.emoji} ${badge.name}`);
                        
                        const embed = new EmbedBuilder()
                            .setTitle('🏅 Nova Badge!')
                            .setColor(config.colors.primary)
                            .setDescription(`${message.author} desbloqueou: ${badge.emoji} **${badge.name}**`)
                            .setFooter({ text: badge.description || '' });
                        
                        await message.channel.send({ embeds: [embed] });
                    }
                }
            }
            
            // Chat history (if service provided)
            if (options.chatHistoryService) {
                await options.chatHistoryService.saveMessage(message, 'user');
            }
            
            // AI response (mentions or DMs)
            const isMentioned = message.mentions.has(client.user);
            const isDM = !message.guild;
            
            if (isMentioned || isDM) {
                const content = message.content
                    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                    .trim();
                
                if (!content) return;
                
                message.channel.sendTyping();
                
                const history = options.chatHistoryService 
                    ? await options.chatHistoryService.getContextMessages(message.author.id, message.channel.id, 10)
                    : [];
                
                const messageData = {
                    author: message.author,
                    channel: message.channel,
                    content,
                    userId: message.author.id,
                    channelId: message.channel.id
                };
                
                const result = await ai.generateResponse(messageData, history);
                const responseContent = result.content;
                const moodResult = result.moodResult;
                
                // If mood changed, only send transition message (no AI response)
                // Next message will use the new mood naturally
                if (moodResult.changed && moodResult.transitionMessage) {
                    await message.reply(`_${moodResult.transitionMessage}_`);
                    
                    // Update status message with velha counter
                    if (moodResult.velhaCount > 0) {
                        await updateVelhaStatus(message.channel, moodResult.velhaCount);
                    } else {
                        await updateVelhaStatus(message.channel, 0);
                    }
                    
                    // Don't send AI response - save tokens, next message will use new mood
                    return;
                }
                
                // Send main response (no mood change)
                const sentMessage = await message.reply(responseContent);
                
                // Update status message with velha counter if > 0
                if (moodResult.velhaCount > 0) {
                    await updateVelhaStatus(message.channel, moodResult.velhaCount);
                } else {
                    // Clear status if counter is 0
                    await updateVelhaStatus(message.channel, 0);
                }
                
                // Only save the main response to DB
                if (options.chatHistoryService) {
                    await options.chatHistoryService.saveBotResponse({
                        guildId: message.guild?.id,
                        channelId: message.channel.id,
                        messageId: sentMessage.id,
                        content: responseContent,
                        replyToMessageId: message.id
                    });
                }
            }
        } catch (error) {
            logger.error('NEXUS', `Erro ao processar mensagem: ${error.message}`);
        }
    });
    
    // Slash command handler
    client.on(Events.InteractionCreate, async (interaction) => {
        // Handle buttons
        if (interaction.isButton()) {
            return; // Let collectors handle buttons
        }
        
        // Handle slash commands
        if (!interaction.isChatInputCommand()) return;
        
        const command = client.commands.get(interaction.commandName);
        
        if (!command) {
            logger.warn('NEXUS', `Comando não encontrado: ${interaction.commandName}`);
            return;
        }
        
        try {
            await command.execute(interaction);
            logger.discord.command(
                interaction.commandName, 
                interaction.user.username, 
                interaction.guild?.name || 'DM'
            );
        } catch (error) {
            logger.error('NEXUS', `Erro no comando /${interaction.commandName}: ${error.message}`);
            
            const errorMsg = { 
                content: '❌ Ocorreu um erro ao executar este comando!', 
                ephemeral: true 
            };
            
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp(errorMsg);
            } else {
                await interaction.reply(errorMsg);
            }
        }
    });
    
    // Member join
    client.on(Events.GuildMemberAdd, async (member) => {
        logger.discord.join(member.user.username, member.guild.name);
        
        const welcomeChannel = member.guild.channels.cache.find(
            ch => ch.name.includes('welcome') || ch.name.includes('bem-vindo') || ch.name === 'general'
        );
        
        if (welcomeChannel) {
            const embed = new EmbedBuilder()
                .setTitle('👋 Bem-vindo(a)!')
                .setColor(config.colors.success)
                .setDescription(`${member} acabou de entrar no servidor!`)
                .setThumbnail(member.user.displayAvatarURL())
                .addFields(
                    { name: '👤 Usuário', value: member.user.tag, inline: true },
                    { name: '📅 Conta criada', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true },
                    { name: '🎯 Membro #', value: `${member.guild.memberCount}`, inline: true }
                )
                .setFooter({ text: 'Use /help para ver os comandos!' })
                .setTimestamp();
            
            await welcomeChannel.send({ embeds: [embed] });
        }
    });
    
    // Error handlers
    client.on('error', (error) => {
        logger.discord.error(error);
    });
    
    process.on('unhandledRejection', (error) => {
        logger.error('SYSTEM', `Unhandled rejection: ${error.message || error}`);
    });
    
    process.on('SIGINT', async () => {
        await shutdown(client);
        process.exit(0);
    });
}

/**
 * Get the Discord client
 */
export function getClient() {
    return client;
}

/**
 * Export everything
 */
export { 
    client,
    config, 
    logger, 
    ai,
    shutdown
};

export default {
    init,
    start,
    getClient,
    shutdown,
    config,
    logger,
    ai
};
