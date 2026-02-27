/**
 * Deploy Slash Commands to Discord API
 * Run this script once to register all commands with Discord
 *
 * Usage: node scripts/deploy-commands.js
 *
 * - Sem DISCORD_GUILD_ID → deploy GLOBAL: comandos aparecem em todos os servidores e na DM.
 * - Com DISCORD_GUILD_ID → deploy só naquele servidor: comandos NÃO aparecem na DM.
 */
import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

import logger from '../src/app/modules/nexus/utils/logger.js';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import all command services from Nexus module
import { utilityCommands } from '../src/app/modules/nexus/services/utilityService.js';
import { moderationCommands } from '../src/app/modules/nexus/services/moderationService.js';
import { funCommands } from '../src/app/modules/nexus/services/funService.js';
import { customCommands } from '../src/app/modules/nexus/commands/customCommands.js';

async function deployCommands() {
    const commands = [];
    
    // Load file-based commands from Nexus module
    const commandsPath = path.join(__dirname, '../src/app/modules/nexus/commands');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
        file.endsWith('.js') && !file.includes('customCommands')
    );
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = await (await import(filePath)).default;
            if ('data' in command) {
                commands.push(command.data.toJSON());
                logger.success('DEPLOY', `Loaded: ${command.data.name}`);
            }
        } catch (error) {
            logger.error('DEPLOY', `Error loading ${file}`, error.message);
        }
    }
    
    // Load all service commands
    const allServiceCommands = [
        ...utilityCommands,
        ...moderationCommands,
        ...funCommands,
        ...customCommands
    ];
    
    for (const command of allServiceCommands) {
        if ('data' in command) {
            commands.push(command.data.toJSON());
            logger.success('DEPLOY', `Loaded: ${command.data.name}`);
        }
    }

    logger.info('DEPLOY', `Total commands to deploy: ${commands.length}`);
    
    // Validate environment variables
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_SECRET_KEY;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands
    
    if (!token || !clientId) {
        logger.error('DEPLOY', 'Missing environment variables!');
        logger.error('DEPLOY', 'Required: DISCORD_TOKEN (ou DISCORD_SECRET_KEY), DISCORD_CLIENT_ID');
        logger.error('DEPLOY', 'Optional: DISCORD_GUILD_ID (for guild-specific deployment)');
        logger.info('DEPLOY', 'Para encontrar o DISCORD_CLIENT_ID: vá em https://discord.com/developers/applications → sua aplicação → Application ID na aba General Information');
        process.exit(1);
    }
    
    // Create REST client
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        logger.info('DEPLOY', 'Starting deployment...');

        let data;

        if (guildId) {
            logger.info('DEPLOY', `Deploying to guild: ${guildId}`);
            logger.warn('DEPLOY', 'Comandos em um guild só NÃO aparecem na DM. Para DM, rode sem DISCORD_GUILD_ID (deploy global).');
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            logger.info('DEPLOY', 'Deploying globally (may take up to 1 hour to propagate)');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }

        logger.success('DEPLOY', `Successfully deployed ${data.length} commands!`);

        data.forEach((cmd, i) => {
            logger.info('DEPLOY', `  ${i + 1}. /${cmd.name} - ${cmd.description}`);
        });
    } catch (error) {
        logger.error('DEPLOY', 'Deployment failed', error.message);
        if (error.rawError) {
            logger.error('DEPLOY', 'Details', JSON.stringify(error.rawError, null, 2));
        }
        process.exit(1);
    }
}

// Run deployment
deployCommands();
