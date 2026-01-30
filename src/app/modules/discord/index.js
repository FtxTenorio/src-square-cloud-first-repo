import { Client, GatewayIntentBits } from 'discord.js';

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
    console.log('Message: ', msg.content);
    console.log('Author', msg.author);
    console.log('User: ', client.user);
    if (msg.author.tag != client.user.tag) {
        let historyMessages = messages.find(message => message.author === msg.author.tag);

        if (!historyMessages) {
            const initialMessages = {
                author: msg.author.tag,
                history: [
                    {msg: msg, content: msg.content}
                ]
            }
            messages.push(initialMessages); 
        } else {
            historyMessages.history.push({msg: msg, content: msg.content})
        }

        historyMessages = messages.find(message => message.author === msg.author.tag);

        console.log('Mensages desse Author', historyMessages)
        
        if(historyMessages.history.length === 1) {
            return msg.reply(`Hello ${msg.author.username}, what you want to do?`);
        } else  {
            msg.channel.send('Initiating your process')
        }

    }
})

export default client