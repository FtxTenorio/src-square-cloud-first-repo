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
import {
    handleRotinaCriarModalSubmit,
    handleRotinaCriarItemModalSubmit,
    handleRotinaCriarParticipantModalSubmit,
    handleRotinaCriarParticipantSelect,
    buildRotinaCriarItemModal,
    buildRotinaCriarParticipantModal,
    getRotinaCriarParticipantSelectPayload,
    ROTINA_CRIAR_ADD_ITEM_BTN_ID,
    ROTINA_CRIAR_ADD_PARTICIPANT_BTN_ID,
    ROTINA_CRIAR_SELECT_PARTICIPANT_ID
} from './commands/routineCommands.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Module state
let client = null;
let isInitialized = false;

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
        
        // Ignorar bots (incluindo a própria Frieren) e mensagens de sistema
        if (message.author.bot || message.system) return;

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
            
            // AI response (mentions or DMs)
            const isMentioned = message.mentions.has(client.user);
            const isDM = !message.guild;

            if (isMentioned || isDM) {
                const content = message.content
                    .replace(new RegExp(`<@!?${client.user.id}>`, 'g'), '')
                    .trim();
                
                if (!content) return;
                
                message.channel.sendTyping();

                // Histórico do canal ANTES de salvar esta mensagem (para não duplicar a atual no contexto)
                const history = options.chatHistoryService
                    ? await options.chatHistoryService.getContextMessages(message.guild?.id || null, message.channel.id, 50)
                    : [];

                // Salvar mensagem de quem mencionou (todas são salvas para contexto do canal)
                if (options.chatHistoryService) {
                    await options.chatHistoryService.saveMessage(message, 'user');
                }

                const messageData = {
                    author: message.author,
                    channel: message.channel,
                    content,
                    userId: message.author.id,
                    channelId: message.channel.id,
                    guildId: message.guild?.id || null
                };
                
                const result = await ai.generateResponse(messageData, history);
                const responseContent = result.content;

                const sentMessage = await message.reply(responseContent);

                // Save bot response to DB
                if (options.chatHistoryService) {
                    await options.chatHistoryService.saveBotResponse({
                        guildId: message.guild?.id,
                        channelId: message.channel.id,
                        messageId: sentMessage.id,
                        content: responseContent,
                        replyToMessageId: message.id
                    });
                }
            } else {
                // Salvar todas as mensagens do canal (sem menção) para a Frieren ver o chat
                if (options.chatHistoryService) {
                    await options.chatHistoryService.saveMessage(message, 'user');
                }
            }
        } catch (error) {
            logger.error('NEXUS', `Erro ao processar mensagem: ${error.message}`);
        }
    });
    
    // Slash command handler
    client.on(Events.InteractionCreate, async (interaction) => {
        // Modal submit (formulários enviados pelo usuário)
        if (interaction.isModalSubmit()) {
            try {
                if (interaction.customId?.startsWith('rotina_criar_modal:')) {
                    await handleRotinaCriarModalSubmit(interaction);
                } else if (interaction.customId === 'rotina_criar_item_modal') {
                    await handleRotinaCriarItemModalSubmit(interaction);
                } else if (interaction.customId === 'rotina_criar_participant_modal') {
                    await handleRotinaCriarParticipantModalSubmit(interaction);
                }
            } catch (err) {
                logger.error('NEXUS', `Erro ao processar modal ${interaction.customId}: ${err.message}`);
                const msg = { content: '❌ Erro ao processar o formulário.', ephemeral: true };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(msg).catch(() => {});
                } else {
                    await interaction.reply(msg).catch(() => {});
                }
            }
            return;
        }

        // Botões do formulário de rotina: responder no global para evitar "Unknown interaction" em ephemeral
        if (interaction.isButton() && interaction.customId === ROTINA_CRIAR_ADD_ITEM_BTN_ID) {
            try {
                await interaction.showModal(buildRotinaCriarItemModal());
            } catch (err) {
                logger.error('NEXUS', `Erro ao abrir modal Adicionar item: ${err.message}`);
                await interaction.reply({ content: 'Não foi possível abrir o formulário. Tente de novo.', ephemeral: true }).catch(() => {});
            }
            return;
        }
        if (interaction.isButton() && interaction.customId === ROTINA_CRIAR_ADD_PARTICIPANT_BTN_ID) {
            try {
                if (interaction.guild) {
                    const payload = await getRotinaCriarParticipantSelectPayload(interaction);
                    await interaction.reply(payload);
                } else {
                    await interaction.showModal(buildRotinaCriarParticipantModal());
                }
            } catch (err) {
                logger.error('NEXUS', `Erro ao abrir Incluir usuário: ${err.message}`);
                await interaction.reply({ content: 'Não foi possível carregar. Tente de novo.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // Select "Incluir usuário" (membros do servidor)
        if (interaction.isStringSelectMenu() && interaction.customId === ROTINA_CRIAR_SELECT_PARTICIPANT_ID) {
            try {
                await handleRotinaCriarParticipantSelect(interaction);
            } catch (err) {
                logger.error('NEXUS', `Erro ao processar select participante: ${err.message}`);
                await interaction.reply({ content: 'Erro ao incluir usuário.', ephemeral: true }).catch(() => {});
            }
            return;
        }

        // Outros botões: collectors nos comandos tratam
        if (interaction.isButton()) {
            return;
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
