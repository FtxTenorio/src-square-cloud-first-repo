import { Client, Collection, Events, GatewayIntentBits } from 'discord.js';
import * as fs from 'fs'
import https from 'node:https';
import path from 'node:path';

const messages = [
    {
        author: 'Tag of Author, avoid store the bot messages',
        history: [
            { msg: 'The entire message object', content: 'The message content from this user!' }
        ]
    }
]

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
})

client.on('messageCreate', (msg) => {
    if (msg.author.tag != client.user.tag) {
        let historyMessages = messages.find(message => message.author === msg.author.tag);

        if (!historyMessages) {
            const initialMessages = {
                author: msg.author.tag,
                history: [
                    { msg: msg, content: msg.content }
                ]
            }
            messages.push(initialMessages);
        } else {
            historyMessages.history.push({ msg: msg, content: msg.content })
        }
        console.log('Mensages desse Author', historyMessages)

        historyMessages = messages.find(message => message.author === msg.author.tag);


        if (historyMessages.history.length === 1) {
            return msg.reply(`Hello ${msg.author.username}, ready to receive beauty message to warm your day?`);
        } else {
            try {
                https.get('https://www.positive-api.online/phrase', (res) => {
                    let data = '';

                    res.on('data', (chunck) => {
                        data += chunck;
                    });

                    res.on('end', (error) => {
                        if (error) {
                            msg.channel.send(error.message)
                        }
                        msg.channel.send(JSON.parse(data).text)
                    });
                })
            } catch (error) {
                console.log(error)
            }
        }

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