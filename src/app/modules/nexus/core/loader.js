/**
 * Nexus Core - Command & Event Loader
 * Dynamically loads commands and events
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import logger from '../utils/logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load all commands from a directory
 */
export async function loadCommands(client, commandsPath) {
    const commands = [];
    
    if (!fs.existsSync(commandsPath)) {
        logger.warn('NEXUS', `Pasta de comandos não encontrada: ${commandsPath}`);
        return commands;
    }
    
    const files = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
        try {
            const filePath = path.join(commandsPath, file);
            const module = await import(`file://${filePath}`);
            
            // Support both default export and named exports
            const commandList = module.default || Object.values(module).filter(c => c?.data && c?.execute);
            
            if (Array.isArray(commandList)) {
                for (const command of commandList) {
                    if (command?.data && command?.execute) {
                        client.commands.set(command.data.name, command);
                        commands.push(command.data.name);
                    }
                }
            } else if (commandList?.data && commandList?.execute) {
                client.commands.set(commandList.data.name, commandList);
                commands.push(commandList.data.name);
            }
        } catch (error) {
            logger.error('NEXUS', `Erro ao carregar comando ${file}: ${error.message}`);
        }
    }
    
    logger.nexus.moduleLoaded('Commands', commands.length);
    return commands;
}

/**
 * Load all events from a directory
 */
export async function loadEvents(client, eventsPath) {
    const events = [];
    
    if (!fs.existsSync(eventsPath)) {
        logger.warn('NEXUS', `Pasta de eventos não encontrada: ${eventsPath}`);
        return events;
    }
    
    const files = fs.readdirSync(eventsPath).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
        try {
            const filePath = path.join(eventsPath, file);
            const module = await import(`file://${filePath}`);
            const event = module.default;
            
            if (!event?.name || !event?.execute) {
                logger.warn('NEXUS', `Evento inválido: ${file}`);
                continue;
            }
            
            if (event.once) {
                client.once(event.name, (...args) => event.execute(...args, client));
            } else {
                client.on(event.name, (...args) => event.execute(...args, client));
            }
            
            events.push(event.name);
        } catch (error) {
            logger.error('NEXUS', `Erro ao carregar evento ${file}: ${error.message}`);
        }
    }
    
    logger.nexus.moduleLoaded('Events', events.length);
    return events;
}

/**
 * Load service commands (utility, fun, moderation, etc)
 */
export async function loadServiceCommands(client, servicesPath) {
    const services = [];
    
    if (!fs.existsSync(servicesPath)) {
        logger.warn('NEXUS', `Pasta de serviços não encontrada: ${servicesPath}`);
        return services;
    }
    
    const files = fs.readdirSync(servicesPath).filter(file => file.endsWith('.js'));
    
    for (const file of files) {
        try {
            const filePath = path.join(servicesPath, file);
            const module = await import(`file://${filePath}`);
            
            // Look for exported command arrays (e.g., funCommands, utilityCommands)
            for (const [key, value] of Object.entries(module)) {
                if (Array.isArray(value)) {
                    for (const command of value) {
                        if (command?.data && command?.execute) {
                            client.commands.set(command.data.name, command);
                            services.push(command.data.name);
                        }
                    }
                }
            }
        } catch (error) {
            logger.error('NEXUS', `Erro ao carregar serviço ${file}: ${error.message}`);
        }
    }
    
    if (services.length > 0) {
        logger.nexus.moduleLoaded('Services', services.length);
    }
    
    return services;
}

/**
 * Get all slash command data for deployment
 */
export function getSlashCommandsData(client) {
    return Array.from(client.commands.values())
        .filter(cmd => cmd.data?.toJSON)
        .map(cmd => cmd.data.toJSON());
}

export default {
    loadCommands,
    loadEvents,
    loadServiceCommands,
    getSlashCommandsData
};
