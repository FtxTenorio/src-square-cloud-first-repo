/**
 * Utility Commands - Weather, Translate, Poll, Remind, Calculator
 */
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import logger from '../utils/logger.js';

// Active reminders (in-memory, consider Redis for persistence)
const reminders = new Map();

// Active polls
const polls = new Map();

/**
 * Weather command - Get weather for a city
 */
export const weatherCommand = {
    data: new SlashCommandBuilder()
        .setName('weather')
        .setDescription('Mostra a previsão do tempo')
        .addStringOption(option =>
            option.setName('cidade')
                .setDescription('Nome da cidade')
                .setRequired(true)),
    
    async execute(interaction) {
        const city = interaction.options.getString('cidade');
        
        await interaction.deferReply();
        
        try {
            // Using wttr.in free API (no key needed)
            const response = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
            
            if (!response.ok) {
                throw new Error('Cidade não encontrada');
            }
            
            const data = await response.json();
            const current = data.current_condition[0];
            const area = data.nearest_area[0];
            
            const embed = new EmbedBuilder()
                .setTitle(`🌤️ Clima em ${area.areaName[0].value}, ${area.country[0].value}`)
                .setColor(0x3498db)
                .addFields(
                    { name: '🌡️ Temperatura', value: `${current.temp_C}°C (Sensação: ${current.FeelsLikeC}°C)`, inline: true },
                    { name: '💧 Umidade', value: `${current.humidity}%`, inline: true },
                    { name: '💨 Vento', value: `${current.windspeedKmph} km/h`, inline: true },
                    { name: '☁️ Condição', value: current.weatherDesc[0].value, inline: true },
                    { name: '👁️ Visibilidade', value: `${current.visibility} km`, inline: true },
                    { name: '🌅 UV Index', value: current.uvIndex, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: 'Dados: wttr.in' });
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply(`❌ Não foi possível obter o clima para "${city}". Verifique o nome da cidade.`);
        }
    }
};

/**
 * Translate command - Translate text
 */
export const translateCommand = {
    data: new SlashCommandBuilder()
        .setName('translate')
        .setDescription('Traduz texto')
        .addStringOption(option =>
            option.setName('texto')
                .setDescription('Texto para traduzir')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('para')
                .setDescription('Idioma de destino')
                .setRequired(false)
                .addChoices(
                    { name: 'Inglês', value: 'en' },
                    { name: 'Português', value: 'pt' },
                    { name: 'Espanhol', value: 'es' },
                    { name: 'Francês', value: 'fr' },
                    { name: 'Alemão', value: 'de' },
                    { name: 'Italiano', value: 'it' },
                    { name: 'Japonês', value: 'ja' },
                    { name: 'Coreano', value: 'ko' },
                    { name: 'Chinês', value: 'zh' }
                )),
    
    async execute(interaction) {
        const text = interaction.options.getString('texto');
        const targetLang = interaction.options.getString('para') || 'en';
        
        await interaction.deferReply();
        
        try {
            // Using LibreTranslate or similar free API
            const response = await fetch('https://api.mymemory.translated.net/get?' + new URLSearchParams({
                q: text,
                langpair: `auto|${targetLang}`
            }));
            
            const data = await response.json();
            
            if (data.responseStatus !== 200) {
                throw new Error('Tradução falhou');
            }
            
            const embed = new EmbedBuilder()
                .setTitle('🌐 Tradução')
                .setColor(0x9b59b6)
                .addFields(
                    { name: '📝 Original', value: text },
                    { name: `🔄 Tradução (${targetLang.toUpperCase()})`, value: data.responseData.translatedText }
                )
                .setFooter({ text: 'Powered by MyMemory' });
            
            await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            await interaction.editReply('❌ Erro ao traduzir. Tente novamente.');
        }
    }
};

/**
 * Poll command - Create a poll
 */
export const pollCommand = {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Cria uma votação')
        .addStringOption(option =>
            option.setName('pergunta')
                .setDescription('Pergunta da votação')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('opcoes')
                .setDescription('Opções separadas por vírgula (max 10)')
                .setRequired(false))
        .addIntegerOption(option =>
            option.setName('duracao')
                .setDescription('Duração em minutos')
                .setRequired(false)),
    
    async execute(interaction) {
        const question = interaction.options.getString('pergunta');
        const optionsStr = interaction.options.getString('opcoes');
        const duration = interaction.options.getInteger('duracao') || 5;
        
        const numberEmojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
        
        let options = optionsStr 
            ? optionsStr.split(',').map(o => o.trim()).slice(0, 10)
            : ['Sim', 'Não'];
        
        const embed = new EmbedBuilder()
            .setTitle('📊 ' + question)
            .setColor(0xe74c3c)
            .setDescription(options.map((opt, i) => `${numberEmojis[i]} ${opt}`).join('\n'))
            .setFooter({ text: `Votação termina em ${duration} minuto(s) • Por ${interaction.user.username}` })
            .setTimestamp();
        
        const message = await interaction.reply({ embeds: [embed], fetchReply: true });
        
        // Add reactions
        for (let i = 0; i < options.length; i++) {
            await message.react(numberEmojis[i]);
        }
        
        // Store poll info
        polls.set(message.id, {
            question,
            options,
            author: interaction.user.id,
            endTime: Date.now() + duration * 60000
        });
        
        // End poll after duration
        setTimeout(async () => {
            try {
                const fetchedMessage = await interaction.channel.messages.fetch(message.id);
                const results = [];
                
                for (let i = 0; i < options.length; i++) {
                    const reaction = fetchedMessage.reactions.cache.get(numberEmojis[i]);
                    results.push({
                        option: options[i],
                        votes: reaction ? reaction.count - 1 : 0 // -1 for bot's reaction
                    });
                }
                
                results.sort((a, b) => b.votes - a.votes);
                const totalVotes = results.reduce((sum, r) => sum + r.votes, 0);
                
                const resultsEmbed = new EmbedBuilder()
                    .setTitle('📊 Resultados: ' + question)
                    .setColor(0x2ecc71)
                    .setDescription(
                        results.map((r, i) => {
                            const pct = totalVotes > 0 ? Math.round((r.votes / totalVotes) * 100) : 0;
                            const bar = '█'.repeat(Math.round(pct / 10)) + '░'.repeat(10 - Math.round(pct / 10));
                            const medal = i === 0 && r.votes > 0 ? '🏆 ' : '';
                            return `${medal}**${r.option}**\n${bar} ${pct}% (${r.votes} votos)`;
                        }).join('\n\n')
                    )
                    .setFooter({ text: `Total: ${totalVotes} votos` })
                    .setTimestamp();
                
                await interaction.followUp({ embeds: [resultsEmbed] });
                polls.delete(message.id);
            } catch (e) {
                logger.error('CMD', 'Erro ao encerrar poll', e.message);
            }
        }, duration * 60000);
    }
};

/**
 * Remind command - Set a reminder
 */
export const remindCommand = {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Define um lembrete')
        .addStringOption(option =>
            option.setName('tempo')
                .setDescription('Tempo (ex: 10m, 1h, 2h30m)')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('mensagem')
                .setDescription('O que você quer lembrar')
                .setRequired(true)),
    
    async execute(interaction) {
        const timeStr = interaction.options.getString('tempo');
        const message = interaction.options.getString('mensagem');
        
        // Parse time string
        const timeRegex = /(\d+)([mhd])/gi;
        let totalMs = 0;
        let match;
        
        while ((match = timeRegex.exec(timeStr)) !== null) {
            const value = parseInt(match[1]);
            const unit = match[2].toLowerCase();
            
            switch (unit) {
                case 'm': totalMs += value * 60000; break;
                case 'h': totalMs += value * 3600000; break;
                case 'd': totalMs += value * 86400000; break;
            }
        }
        
        if (totalMs === 0) {
            return interaction.reply({
                content: '❌ Formato de tempo inválido. Use algo como: `10m`, `1h`, `2h30m`, `1d`',
                ephemeral: true
            });
        }
        
        if (totalMs > 7 * 86400000) {
            return interaction.reply({
                content: '❌ O tempo máximo para lembretes é 7 dias.',
                ephemeral: true
            });
        }
        
        const reminderId = `${interaction.user.id}-${Date.now()}`;
        const endTime = new Date(Date.now() + totalMs);
        
        const timeout = setTimeout(async () => {
            try {
                await interaction.user.send(`⏰ **Lembrete:** ${message}`);
                await interaction.channel.send(`⏰ <@${interaction.user.id}> Lembrete: **${message}**`);
            } catch (e) {
                // User might have DMs disabled
                await interaction.channel.send(`⏰ <@${interaction.user.id}> Lembrete: **${message}**`);
            }
            reminders.delete(reminderId);
        }, totalMs);
        
        reminders.set(reminderId, { timeout, message, endTime, userId: interaction.user.id });
        
        const embed = new EmbedBuilder()
            .setTitle('⏰ Lembrete definido!')
            .setColor(0xf39c12)
            .addFields(
                { name: '📝 Mensagem', value: message },
                { name: '⏱️ Quando', value: `<t:${Math.floor(endTime.getTime() / 1000)}:R>` }
            )
            .setFooter({ text: `ID: ${reminderId.split('-')[1]}` });
        
        await interaction.reply({ embeds: [embed] });
    }
};

/**
 * Calculate command - Math calculator
 */
export const calcCommand = {
    data: new SlashCommandBuilder()
        .setName('calc')
        .setDescription('Calculadora')
        .addStringOption(option =>
            option.setName('expressao')
                .setDescription('Expressão matemática (ex: 2+2, sqrt(16), 5*3)')
                .setRequired(true)),
    
    async execute(interaction) {
        const expression = interaction.options.getString('expressao');
        
        try {
            // Safe math evaluation (no eval!)
            const result = safeMathEval(expression);
            
            const embed = new EmbedBuilder()
                .setTitle('🧮 Calculadora')
                .setColor(0x1abc9c)
                .addFields(
                    { name: '📝 Expressão', value: `\`${expression}\`` },
                    { name: '✅ Resultado', value: `\`${result}\`` }
                );
            
            await interaction.reply({ embeds: [embed] });
        } catch (error) {
            await interaction.reply({
                content: `❌ Erro ao calcular: ${error.message}`,
                ephemeral: true
            });
        }
    }
};

/**
 * Safe math evaluation without eval()
 */
function safeMathEval(expression) {
    // Allowed characters and functions
    const allowed = /^[\d\s+\-*/().^%]+$/;
    const functions = ['sqrt', 'sin', 'cos', 'tan', 'log', 'abs', 'round', 'floor', 'ceil', 'pow', 'pi', 'e'];
    
    let expr = expression.toLowerCase()
        .replace(/\s/g, '')
        .replace(/pi/g, Math.PI.toString())
        .replace(/e(?![xp])/g, Math.E.toString())
        .replace(/\^/g, '**')
        .replace(/sqrt\(([^)]+)\)/g, 'Math.sqrt($1)')
        .replace(/sin\(([^)]+)\)/g, 'Math.sin($1)')
        .replace(/cos\(([^)]+)\)/g, 'Math.cos($1)')
        .replace(/tan\(([^)]+)\)/g, 'Math.tan($1)')
        .replace(/log\(([^)]+)\)/g, 'Math.log10($1)')
        .replace(/abs\(([^)]+)\)/g, 'Math.abs($1)')
        .replace(/round\(([^)]+)\)/g, 'Math.round($1)')
        .replace(/floor\(([^)]+)\)/g, 'Math.floor($1)')
        .replace(/ceil\(([^)]+)\)/g, 'Math.ceil($1)')
        .replace(/pow\(([^,]+),([^)]+)\)/g, 'Math.pow($1,$2)');
    
    // Validate expression
    const cleanExpr = expr.replace(/Math\.\w+/g, '').replace(/[()]/g, '');
    if (!allowed.test(cleanExpr)) {
        throw new Error('Expressão inválida');
    }
    
    // Create safe function
    const fn = new Function(`"use strict"; return (${expr})`);
    const result = fn();
    
    if (typeof result !== 'number' || !isFinite(result)) {
        throw new Error('Resultado inválido');
    }
    
    return Number.isInteger(result) ? result : parseFloat(result.toFixed(10));
}

/**
 * Coin flip command
 */
export const coinCommand = {
    data: new SlashCommandBuilder()
        .setName('coin')
        .setDescription('Joga uma moeda'),
    
    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Cara' : 'Coroa';
        const emoji = result === 'Cara' ? '🪙' : '💿';
        
        await interaction.reply(`${emoji} A moeda caiu em: **${result}**!`);
    }
};

export const utilityCommands = [
    weatherCommand,
    translateCommand,
    pollCommand,
    remindCommand,
    calcCommand,
    coinCommand
];

export default utilityCommands;
