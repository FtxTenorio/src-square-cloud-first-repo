/**
 * Nexus Core - Discord Client Setup
 * Initializes and configures the Discord.js client
 */

import { Client, Collection, GatewayIntentBits, Partials } from 'discord.js';
import logger from '../utils/logger.js';
import config from './config.js';

/**
 * Create configured Discord client
 */
export function createClient() {
    const client = new Client({
        intents: [
            GatewayIntentBits.Guilds,
            GatewayIntentBits.GuildMessages,
            GatewayIntentBits.MessageContent,
            GatewayIntentBits.GuildMembers,
            GatewayIntentBits.GuildMessageReactions,
            GatewayIntentBits.DirectMessages,
            GatewayIntentBits.GuildPresences
        ],
        partials: [
            Partials.Message,
            Partials.Channel,
            Partials.Reaction
        ]
    });
    
    // Initialize collections
    client.commands = new Collection();
    client.cooldowns = new Collection();
    client.config = config;
    
    // Add utility methods
    client.getCommand = (name) => client.commands.get(name);
    client.hasCommand = (name) => client.commands.has(name);
    
    logger.debug('NEXUS', 'Cliente Discord criado');
    
    return client;
}

/**
 * Login to Discord
 */
export async function login(client, token) {
    if (!token) {
        throw new Error('Discord token não fornecido');
    }
    
    logger.info('NEXUS', 'Conectando ao Discord...');
    
    try {
        await client.login(token);
        logger.success('NEXUS', 'Conectado ao Discord');
        return true;
    } catch (error) {
        logger.error('NEXUS', `Falha ao conectar: ${error.message}`);
        throw error;
    }
}

/**
 * Graceful shutdown
 */
export async function shutdown(client) {
    logger.nexus.shutdown();
    
    if (client) {
        client.destroy();
    }
}

export default { createClient, login, shutdown };
