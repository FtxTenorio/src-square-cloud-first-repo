import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import * as fs from 'fs'
import https from 'node:https';
import path from 'node:path';
import chatHistoryService from './chatHistoryService.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
})

client.on('messageCreate', async (msg) => {
    if (msg.author.bot) return; // Ignore bot messages
    
    try {
        // Save user message to MongoDB
        await chatHistoryService.saveMessage(msg, 'user');
        
        // Get conversation context (last 10 messages)
        const context = await chatHistoryService.getContextMessages(
            msg.author.id,
            msg.channel.id,
            10
        );
        
        const isFirstMessage = context.length <= 1;
        
        if (isFirstMessage) {
            const reply = await msg.reply(`Hello ${msg.author.username}, ready to receive beauty message to warm your day?`);
            
            // Save bot response
            await chatHistoryService.saveBotResponse({
                guildId: msg.guild?.id,
                channelId: msg.channel.id,
                messageId: reply.id,
                content: reply.content,
                replyToMessageId: msg.id,
                conversationId: msg.channel.id
            });
        } else {
            const startTime = Date.now();
            
            https.get('https://www.positive-api.online/phrase', (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', async () => {
                    try {
                        const responseText = JSON.parse(data).text;
                        const sentMsg = await msg.channel.send(responseText);
                        
                        // Save bot response with response time
                        await chatHistoryService.saveBotResponse({
                            guildId: msg.guild?.id,
                            channelId: msg.channel.id,
                            messageId: sentMsg.id,
                            content: responseText,
                            replyToMessageId: msg.id,
                            botResponseTime: Date.now() - startTime,
                            conversationId: msg.channel.id
                        });
                    } catch (parseError) {
                        console.error('Error parsing response:', parseError);
                    }
                });
            }).on('error', (error) => {
                console.error('HTTP error:', error);
                msg.channel.send('Sorry, I had trouble getting a message for you.');
            });
        }
    } catch (error) {
        console.error('Error processing message:', error);
    }
})

client.commands = new Collection();

const commandsPath = path.join(import.meta.dirname, 'commands/utility');
const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));
for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    const command = await (await import(filePath)).default;
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        console.error(`No command matching "${interaction.commandName}" was found.`);
        return;
    }

    try {
        await command.execute(interaction);
    } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({
                content: 'There was an error while executing this command!',
                flags: MessageFlags.Ephemeral,
            });
        } else {
            await interaction.reply({
                content: 'There was an error while executing this command!',
                flags: MessageFlags.Ephemeral,
            });
        }
    }
});

export default client