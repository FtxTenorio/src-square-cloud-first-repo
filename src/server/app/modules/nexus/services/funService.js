/**
 * Fun Commands - Games, jokes, memes, and entertainment
 */
import { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// 8-Ball responses
const MAGIC_8BALL = {
    positive: [
        'Com certeza!', 'Definitivamente sim!', 'Sem dúvida!',
        'Sim, com certeza!', 'Pode apostar que sim!', 'As estrelas dizem sim!',
        'É muito provável!', 'Parece que sim!', 'Os sinais são positivos!'
    ],
    neutral: [
        'Talvez...', 'Não tenho certeza', 'Pergunte novamente mais tarde',
        'Melhor não dizer agora', 'Concentre-se e pergunte de novo',
        'Hmm, difícil dizer...', 'As forças cósmicas estão confusas'
    ],
    negative: [
        'Não conte com isso', 'Minha resposta é não', 'Muito duvidoso',
        'As perspectivas não são boas', 'Não!', 'Improvável',
        'Os astros dizem não', 'Definitivamente não', 'Nem pense nisso!'
    ]
};

// Jokes database - Frieren universe inspired
const JOKES = [
    { setup: 'Por que a Frieren demora tanto pra responder mensagens?', punchline: 'Porque 10 anos pra ela é tipo 10 minutos! ⏰' },
    { setup: 'O que a Frieren disse quando perguntaram se ela tava com pressa?', punchline: 'Calma, só passou um século! 🧝‍♀️' },
    { setup: 'Por que o Himmel nunca desistiu de flertar com a Frieren?', punchline: 'Porque herói de verdade tem paciência de elfo! 💪' },
    { setup: 'O que a Fern disse pra Frieren na hora do café da manhã?', punchline: 'Mestre, já são 3 da tarde... 😑' },
    { setup: 'Por que a Frieren coleciona magias inúteis?', punchline: 'Porque em 1000 anos, uma hora vai servir pra alguma coisa! ✨' },
    { setup: 'O que acontece quando a Frieren diz "volto já"?', punchline: 'A próxima geração que aguarde! 👴' },
    { setup: 'Por que o Stark tem medo de tudo?', punchline: 'Porque o mestre dele era o Eisen - trauma é hereditário! 😱' },
    { setup: 'O que a Frieren mais gosta de fazer?', punchline: 'Dormir, comer doces, e fingir que não se importa! 😴🍰' },
    { setup: 'Por que a Frieren foi reprovada no exame de mago?', punchline: 'Ela achou que 2 horas de prova era muito rápido! 📝' },
    { setup: 'O que o Himmel falou antes de morrer?', punchline: 'Frieren, não esquece de mim... em uns 500 anos tá bom! 💔' },
    { setup: 'Por que a Fern é a melhor aprendiz?', punchline: 'Porque ela aprendeu a acordar a Frieren - isso é magia de alto nível! 🌅' },
    { setup: 'Como a Frieren conta o tempo?', punchline: 'Ontem = século passado, Hoje = esta década, Amanhã = daqui 50 anos! 📅' },
    { setup: 'Por que a Frieren foi derrotar o Rei Demônio?', punchline: 'Ela tinha 10 anos livres e nada melhor pra fazer! ⚔️' },
    { setup: 'O que a Frieren acha de relacionamentos?', punchline: 'Interessante, mas me pergunta de novo daqui 80 anos! 💭' },
    { setup: 'Por que a Frieren é a maga mais forte?', punchline: 'Ela teve tempo de sobra pra estudar... tipo, MUITO tempo! 📚' }
];

// Compliments - Frieren perspective
const COMPLIMENTS = [
    'Você me lembra o Himmel... isso é um elogio, eu acho. 🌸',
    'Interessante. Vou lembrar de você daqui a 100 anos. ✨',
    'Você é tão especial quanto uma magia inútil que eu ainda não coletei. �',
    'A Fern gostaria de você. Ela tem bom gosto... às vezes. 🧝‍♀️',
    'Você brilha mais que o nascer do sol... que eu geralmente durmo e perco. 🌅',
    'Se você fosse uma magia, eu te adicionaria à minha coleção. ⭐',
    'Himmel diria algo inspirador agora. Você merece isso. 💫',
    'Você é mais reconfortante que um campo de flores ao entardecer. 🌻',
    'Passei 1000 anos e você é uma das pessoas mais interessantes... até agora. 🧙‍♀️',
    'Você me faz querer entender melhor os humanos. Isso é raro. 💭',
    'Sua presença é agradável. Posso ficar aqui por mais... uns 50 anos? ☕',
    'O Himmel teria gostado de você. Ele gostava de pessoas assim. �'
];

// Roasts (light-hearted) - Frieren's brutal honesty
const ROASTS = [
    'Você me lembra alguém... mas já esqueci quem. Deve não ter sido importante. 🤔',
    'O Himmel era mais interessante. E ele morreu faz 80 anos. �',
    'Você tem o carisma de um mimic disfarçado de baú. 📦',
    'Stark é medroso, mas pelo menos ele é útil em batalha... 😬',
    'Vou anotar seu nome. Talvez eu lembre daqui a 200 anos. Talvez. �',
    'A Fern ficaria desapontada com você. E ela fica desapontada comigo direto. �',
    'Você seria derrotado pelo demônio mais fraco que já enfrentei. E era um sapo. �',
    'Seu potencial mágico é... presente. Só isso. Presente. ✨',
    'O Eisen dizia que paciência é uma virtude. Você testa essa teoria. 🪨',
    'Até as minhas magias inúteis são mais úteis que você. �',
    'Você fala demais. Humanos falam demais. É cansativo. 😴',
    'Se você fosse um grimório, estaria na seção de "não vale a pena ler". �'
];

// ASCII art for wins/losses
const ASCII_ART = {
    winner: '🎉 VOCÊ GANHOU! 🎉',
    loser: '😢 Você perdeu...',
    tie: '🤝 Empate!'
};

/**
 * 8-Ball command
 */
export const eightBallCommand = {
    data: new SlashCommandBuilder()
        .setName('8ball')
        .setDescription('Pergunte à bola mágica')
        .addStringOption(option =>
            option.setName('pergunta')
                .setDescription('Sua pergunta')
                .setRequired(true)),
    
    async execute(interaction) {
        const question = interaction.options.getString('pergunta');
        
        // Random category
        const rand = Math.random();
        let category, color;
        if (rand < 0.4) {
            category = MAGIC_8BALL.positive;
            color = 0x2ecc71;
        } else if (rand < 0.7) {
            category = MAGIC_8BALL.neutral;
            color = 0xf1c40f;
        } else {
            category = MAGIC_8BALL.negative;
            color = 0xe74c3c;
        }
        
        const answer = category[Math.floor(Math.random() * category.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('🎱 Bola 8 Mágica')
            .setColor(color)
            .addFields(
                { name: '❓ Pergunta', value: question },
                { name: '🔮 Resposta', value: `**${answer}**` }
            )
            .setFooter({ text: `Perguntado por ${interaction.user.username}` })
            .setTimestamp();
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Roll dice command
 */
export const rollCommand = {
    data: new SlashCommandBuilder()
        .setName('roll')
        .setDescription('Rola dados')
        .addStringOption(option =>
            option.setName('dados')
                .setDescription('Formato: NdX (ex: 2d6, 1d20, 3d8+5)')
                .setRequired(false)),
    
    async execute(interaction) {
        const input = interaction.options.getString('dados') || '1d6';
        
        // Parse dice notation
        const match = input.match(/^(\d+)?d(\d+)([+-]\d+)?$/i);
        
        if (!match) {
            return interaction.reply({ 
                content: '❌ Formato inválido! Use: NdX (ex: 2d6, 1d20, 3d8+5)', 
                ephemeral: true 
            });
        }
        
        const numDice = parseInt(match[1] || '1');
        const diceSize = parseInt(match[2]);
        const modifier = parseInt(match[3] || '0');
        
        if (numDice > 100 || diceSize > 1000) {
            return interaction.reply({ content: '❌ Dados demais ou muito grandes!', ephemeral: true });
        }
        
        // Roll dice
        const rolls = [];
        for (let i = 0; i < numDice; i++) {
            rolls.push(Math.floor(Math.random() * diceSize) + 1);
        }
        
        const sum = rolls.reduce((a, b) => a + b, 0);
        const total = sum + modifier;
        
        // Visual representation
        const diceEmojis = { 1: '⚀', 2: '⚁', 3: '⚂', 4: '⚃', 5: '⚄', 6: '⚅' };
        const rollsStr = rolls.map(r => diceSize === 6 ? diceEmojis[r] : `[${r}]`).join(' ');
        
        const embed = new EmbedBuilder()
            .setTitle('🎲 Rolagem de Dados')
            .setColor(0x9b59b6)
            .addFields(
                { name: '🎯 Dados', value: input.toUpperCase() },
                { name: '📊 Resultados', value: rollsStr },
                { name: '➕ Total', value: `**${total}**${modifier ? ` (${sum}${modifier >= 0 ? '+' : ''}${modifier})` : ''}` }
            )
            .setFooter({ text: `Rolado por ${interaction.user.username}` });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Joke command
 */
export const jokeCommand = {
    data: new SlashCommandBuilder()
        .setName('joke')
        .setDescription('Conta uma piada do universo Frieren'),
    
    async execute(interaction) {
        const joke = JOKES[Math.floor(Math.random() * JOKES.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('😄 Piada')
            .setColor(0xf39c12)
            .setDescription(`**${joke.setup}**`)
            .setFooter({ text: 'Clique no botão para ver a resposta!' });
        
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('joke_punchline')
                    .setLabel('Ver resposta')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🥁')
            );
        
        const message = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });
        
        // Button collector
        const collector = message.createMessageComponentCollector({ time: 30000 });
        
        collector.on('collect', async (i) => {
            const revealEmbed = new EmbedBuilder()
                .setTitle('😄 Piada')
                .setColor(0x2ecc71)
                .setDescription(`**${joke.setup}**\n\n${joke.punchline} 🤣`);
            
            await i.update({ embeds: [revealEmbed], components: [] });
        });
        
        collector.on('end', () => {
            // Remove button after timeout
            message.edit({ components: [] }).catch(() => {});
        });
    }
};

/**
 * Compliment command
 */
export const complimentCommand = {
    data: new SlashCommandBuilder()
        .setName('compliment')
        .setDescription('Elogia alguém')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Quem você quer elogiar')
                .setRequired(false)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario') || interaction.user;
        const compliment = COMPLIMENTS[Math.floor(Math.random() * COMPLIMENTS.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('💖 Elogio')
            .setColor(0xe91e63)
            .setDescription(`**${user.username}**, ${compliment}`)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: `Elogio de ${interaction.user.username}` });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Roast command (light-hearted)
 */
export const roastCommand = {
    data: new SlashCommandBuilder()
        .setName('roast')
        .setDescription('Zoeira leve com alguém (de brincadeira!)')
        .addUserOption(option =>
            option.setName('usuario')
                .setDescription('Quem você quer zoar')
                .setRequired(true)),
    
    async execute(interaction) {
        const user = interaction.options.getUser('usuario');
        
        if (user.id === interaction.client.user.id) {
            return interaction.reply('Nice try, mas eu sou perfeito! 😎');
        }
        
        const roast = ROASTS[Math.floor(Math.random() * ROASTS.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('🔥 Roast')
            .setColor(0xe67e22)
            .setDescription(`${user.username}, ${roast}`)
            .setThumbnail(user.displayAvatarURL())
            .setFooter({ text: '⚠️ Apenas brincadeira! Sem maldade!' });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Rock Paper Scissors command
 */
export const rpsCommand = {
    data: new SlashCommandBuilder()
        .setName('rps')
        .setDescription('Pedra, Papel ou Tesoura')
        .addStringOption(option =>
            option.setName('escolha')
                .setDescription('Sua escolha')
                .setRequired(true)
                .addChoices(
                    { name: '🪨 Pedra', value: 'rock' },
                    { name: '📄 Papel', value: 'paper' },
                    { name: '✂️ Tesoura', value: 'scissors' }
                )),
    
    async execute(interaction) {
        const choices = ['rock', 'paper', 'scissors'];
        const emojis = { rock: '🪨', paper: '📄', scissors: '✂️' };
        const names = { rock: 'Pedra', paper: 'Papel', scissors: 'Tesoura' };
        
        const userChoice = interaction.options.getString('escolha');
        const botChoice = choices[Math.floor(Math.random() * choices.length)];
        
        let result, color;
        if (userChoice === botChoice) {
            result = ASCII_ART.tie;
            color = 0xf1c40f;
        } else if (
            (userChoice === 'rock' && botChoice === 'scissors') ||
            (userChoice === 'paper' && botChoice === 'rock') ||
            (userChoice === 'scissors' && botChoice === 'paper')
        ) {
            result = ASCII_ART.winner;
            color = 0x2ecc71;
        } else {
            result = ASCII_ART.loser;
            color = 0xe74c3c;
        }
        
        const embed = new EmbedBuilder()
            .setTitle('🎮 Pedra, Papel ou Tesoura')
            .setColor(color)
            .addFields(
                { name: 'Você', value: `${emojis[userChoice]} ${names[userChoice]}`, inline: true },
                { name: 'VS', value: '⚔️', inline: true },
                { name: 'Bot', value: `${emojis[botChoice]} ${names[botChoice]}`, inline: true }
            )
            .setDescription(`\n${result}`);
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Random meme command
 */
export const memeCommand = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Mostra um meme aleatório'),
    
    async execute(interaction) {
        await interaction.deferReply();
        
        try {
            const subreddits = ['programmerhumor', 'memes', 'dankmemes', 'wholesomememes'];
            const subreddit = subreddits[Math.floor(Math.random() * subreddits.length)];
            
            const response = await fetch(`https://meme-api.com/gimme/${subreddit}`);
            const data = await response.json();
            
            if (!data.url) {
                throw new Error('Meme não encontrado');
            }
            
            const embed = new EmbedBuilder()
                .setTitle(data.title)
                .setColor(0xff4500)
                .setImage(data.url)
                .setFooter({ text: `r/${data.subreddit} • 👍 ${data.ups}` });
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('😢 Não consegui encontrar um meme agora. Tente novamente!');
        }
    }
};

/**
 * Choose command - picks randomly from options
 */
export const chooseCommand = {
    data: new SlashCommandBuilder()
        .setName('choose')
        .setDescription('Escolhe entre várias opções')
        .addStringOption(option =>
            option.setName('opcoes')
                .setDescription('Opções separadas por vírgula')
                .setRequired(true)),
    
    async execute(interaction) {
        const input = interaction.options.getString('opcoes');
        const options = input.split(',').map(o => o.trim()).filter(o => o);
        
        if (options.length < 2) {
            return interaction.reply({ content: '❌ Preciso de pelo menos 2 opções!', ephemeral: true });
        }
        
        const chosen = options[Math.floor(Math.random() * options.length)];
        
        const embed = new EmbedBuilder()
            .setTitle('🤔 Decisão Tomada!')
            .setColor(0x3498db)
            .addFields(
                { name: '📋 Opções', value: options.map(o => `• ${o}`).join('\n') },
                { name: '✨ Escolhido', value: `**${chosen}**` }
            )
            .setFooter({ text: 'A sorte decidiu!' });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Rate command - rates something out of 10
 */
export const rateCommand = {
    data: new SlashCommandBuilder()
        .setName('rate')
        .setDescription('Avalia algo de 0 a 10')
        .addStringOption(option =>
            option.setName('coisa')
                .setDescription('O que você quer avaliar')
                .setRequired(true)),
    
    async execute(interaction) {
        const thing = interaction.options.getString('coisa');
        
        // Generate "consistent" rating based on input hash
        let hash = 0;
        for (let i = 0; i < thing.length; i++) {
            hash = ((hash << 5) - hash) + thing.charCodeAt(i);
            hash = hash & hash;
        }
        const rating = Math.abs(hash % 11); // 0-10
        
        const bars = '█'.repeat(rating) + '░'.repeat(10 - rating);
        
        let comment;
        if (rating <= 2) comment = 'Hmm... não é pra tanto 😬';
        else if (rating <= 4) comment = 'Pode melhorar 🤷';
        else if (rating <= 6) comment = 'Tá bom! 👍';
        else if (rating <= 8) comment = 'Muito bom! 🔥';
        else comment = 'PERFEITO! 🌟';
        
        const embed = new EmbedBuilder()
            .setTitle('⭐ Avaliação')
            .setColor(rating >= 7 ? 0x2ecc71 : rating >= 4 ? 0xf1c40f : 0xe74c3c)
            .addFields(
                { name: '📝 Avaliando', value: thing },
                { name: '📊 Nota', value: `${bars} **${rating}/10**` }
            )
            .setDescription(comment);
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Ship command - compatibility test
 */
export const shipCommand = {
    data: new SlashCommandBuilder()
        .setName('ship')
        .setDescription('Teste de compatibilidade')
        .addUserOption(option =>
            option.setName('pessoa1')
                .setDescription('Primeira pessoa')
                .setRequired(true))
        .addUserOption(option =>
            option.setName('pessoa2')
                .setDescription('Segunda pessoa')
                .setRequired(true)),
    
    async execute(interaction) {
        const person1 = interaction.options.getUser('pessoa1');
        const person2 = interaction.options.getUser('pessoa2');
        
        // Generate "consistent" compatibility
        const combined = [person1.id, person2.id].sort().join('');
        let hash = 0;
        for (let i = 0; i < combined.length; i++) {
            hash = ((hash << 5) - hash) + combined.charCodeAt(i);
            hash = hash & hash;
        }
        const compatibility = Math.abs(hash % 101); // 0-100
        
        // Ship name
        const name1 = person1.username.slice(0, Math.ceil(person1.username.length / 2));
        const name2 = person2.username.slice(Math.floor(person2.username.length / 2));
        const shipName = name1 + name2;
        
        let comment, color;
        if (compatibility <= 20) {
            comment = '💔 Melhor só amigos...';
            color = 0xe74c3c;
        } else if (compatibility <= 40) {
            comment = '🤔 Talvez com muito esforço...';
            color = 0xe67e22;
        } else if (compatibility <= 60) {
            comment = '💕 Tem potencial!';
            color = 0xf1c40f;
        } else if (compatibility <= 80) {
            comment = '💖 Combinam muito!';
            color = 0xe91e63;
        } else {
            comment = '💞 PERFEITOS UM PRO OUTRO!';
            color = 0xff69b4;
        }
        
        const bar = '💗'.repeat(Math.floor(compatibility / 10)) + '🖤'.repeat(10 - Math.floor(compatibility / 10));
        
        const embed = new EmbedBuilder()
            .setTitle(`💘 Ship: ${shipName}`)
            .setColor(color)
            .setDescription(`${person1.username} 💕 ${person2.username}`)
            .addFields(
                { name: '💝 Compatibilidade', value: `${bar}\n**${compatibility}%**` }
            )
            .setFooter({ text: comment });
        
        await interaction.reply({ embeds: [embed] });
    }
};

export const funCommands = [
    eightBallCommand,
    rollCommand,
    jokeCommand,
    complimentCommand,
    roastCommand,
    rpsCommand,
    memeCommand,
    chooseCommand,
    rateCommand,
    shipCommand
];

export default funCommands;
