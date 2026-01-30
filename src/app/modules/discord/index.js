import { Client, GatewayIntentBits } from 'discord.js';

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

client.on('ready', () => {
    console.log(`Logged in as ${client.user.tag}`)
})

client.on('messageCreate', (msg) => {
    console.log('Message: ', msg.content);
    if (msg.author != client.user.tag) {
        msg.reply('Hello!')
        msg.channel.send('How are you?')
    }
})

export default client