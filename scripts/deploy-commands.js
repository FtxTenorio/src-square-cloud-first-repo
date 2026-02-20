/**
 * Deploy Slash Commands to Discord API
 * Run this script once to register all commands with Discord
 * 
 * Usage: node scripts/deploy-commands.js
 */
import { REST, Routes } from 'discord.js';
import * as fs from 'fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Import all command services
import { utilityCommands } from '../src/app/modules/discord/services/utilityService.js';
import { moderationCommands } from '../src/app/modules/discord/services/moderationService.js';
import { funCommands } from '../src/app/modules/discord/services/funService.js';
import { customCommands } from '../src/app/modules/discord/commands/utility/customCommands.js';

async function deployCommands() {
    const commands = [];
    
    // Load file-based commands (ping, server, user)
    const commandsPath = path.join(__dirname, '../src/app/modules/discord/commands/utility');
    const commandFiles = fs.readdirSync(commandsPath).filter(file => 
        file.endsWith('.js') && !file.includes('customCommands')
    );
    
    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = await (await import(filePath)).default;
            if ('data' in command) {
                commands.push(command.data.toJSON());
                console.log(`✅ Loaded: ${command.data.name}`);
            }
        } catch (error) {
            console.error(`❌ Error loading ${file}:`, error.message);
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
            console.log(`✅ Loaded: ${command.data.name}`);
        }
    }
    
    console.log(`\n📦 Total commands to deploy: ${commands.length}`);
    
    // Validate environment variables
    const token = process.env.DISCORD_TOKEN || process.env.DISCORD_SECRET_KEY;
    const clientId = process.env.DISCORD_CLIENT_ID;
    const guildId = process.env.DISCORD_GUILD_ID; // Optional: for guild-specific commands
    
    if (!token || !clientId) {
        console.error('\n❌ Missing environment variables!');
        console.error('Required: DISCORD_TOKEN (ou DISCORD_SECRET_KEY), DISCORD_CLIENT_ID');
        console.error('Optional: DISCORD_GUILD_ID (for guild-specific deployment)');
        console.error('\n💡 Para encontrar o DISCORD_CLIENT_ID:');
        console.error('   1. Vá para https://discord.com/developers/applications');
        console.error('   2. Selecione sua aplicação');
        console.error('   3. Copie o "Application ID" na aba General Information');
        process.exit(1);
    }
    
    // Create REST client
    const rest = new REST({ version: '10' }).setToken(token);
    
    try {
        console.log('\n🚀 Starting deployment...\n');
        
        let data;
        
        if (guildId) {
            // Deploy to specific guild (instant, good for testing)
            console.log(`📍 Deploying to guild: ${guildId}`);
            data = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: commands }
            );
        } else {
            // Deploy globally (takes up to 1 hour to propagate)
            console.log('🌍 Deploying globally (may take up to 1 hour)');
            data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: commands }
            );
        }
        
        console.log(`\n✅ Successfully deployed ${data.length} commands!`);
        
        // List deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach((cmd, i) => {
            console.log(`   ${i + 1}. /${cmd.name} - ${cmd.description}`);
        });
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        if (error.rawError) {
            console.error('Details:', JSON.stringify(error.rawError, null, 2));
        }
        process.exit(1);
    }
}

// Run deployment
deployCommands();
