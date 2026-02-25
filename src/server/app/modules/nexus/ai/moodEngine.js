/**
 * Nexus AI - Mood Engine
 * Humor por canal: só a IA (GPT-4o-mini) decide, a cada 10 mensagens no chat.
 * Persiste estado no MongoDB.
 */

import logger from '../utils/logger.js';
import axios from 'axios';
import ChannelMood from '../models/ChannelMood.js';

const channelMoodsCache = new Map();

const MOOD_ANALYSIS_INTERVAL = 10;

/**
 * Get or create channel mood state (from DB with cache)
 */
async function getChannelState(channelId, guildId = 'DM') {
    if (channelMoodsCache.has(channelId)) {
        return channelMoodsCache.get(channelId);
    }

    try {
        let moodDoc = await ChannelMood.findOne({ channelId });

        if (!moodDoc) {
            moodDoc = await ChannelMood.create({
                channelId,
                guildId,
                currentMood: 'friendly',
                velhaCounter: 0,
                messagesSinceMoodChange: 0
            });
            logger.debug('MOOD', `Novo canal registrado: ${channelId}`);
        }

        const state = {
            currentMood: moodDoc.currentMood,
            velhaCounter: moodDoc.velhaCounter,
            lastChange: moodDoc.lastChange,
            messagesSinceMoodChange: moodDoc.messagesSinceMoodChange ?? 0,
            stats: moodDoc.stats,
            _id: moodDoc._id
        };

        channelMoodsCache.set(channelId, state);
        return state;
    } catch (error) {
        logger.error('MOOD', `Erro ao carregar mood do DB: ${error.message}`);
        const fallback = {
            currentMood: 'friendly',
            velhaCounter: 0,
            lastChange: Date.now(),
            messagesSinceMoodChange: 0
        };
        channelMoodsCache.set(channelId, fallback);
        return fallback;
    }
}

/**
 * Save channel mood state to DB
 */
async function saveChannelState(channelId, state) {
    try {
        await ChannelMood.findOneAndUpdate(
            { channelId },
            {
                currentMood: state.currentMood,
                velhaCounter: state.velhaCounter ?? 0,
                lastChange: state.lastChange || new Date(),
                messagesSinceMoodChange: state.messagesSinceMoodChange ?? 0,
                stats: state.stats
            },
            { upsert: true }
        );
    } catch (error) {
        logger.error('MOOD', `Erro ao salvar mood no DB: ${error.message}`);
    }
}

/**
 * Analyze mood using GPT-4o-mini. A IA decide tudo (incluindo se "velha"/rude → chorona ou brava).
 */
async function analyzeWithAI(message, currentMood) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: `Você é um analisador de humor para um bot de Discord inspirado na Frieren.
Analise a mensagem do usuário e decida qual humor a Frieren deveria ter.

Humores disponíveis:
- friendly: Padrão, calma e levemente desapegada
- sage: Reflexiva, filosófica, quando pedem conselhos ou falam de coisas profundas
- brava: Irritada, quando o usuário é impaciente, rude, ofensivo ou a chama de "velha" etc.
- chorona: Triste, quando mencionam Himmel, perda, saudade, ou quando ofensas repetidas a magoam

Humor atual: ${currentMood}

Você decide tudo: se o usuário for rude ou chamar de velha, pode escolher brava ou chorona conforme o contexto.
Responda APENAS com uma palavra: friendly, sage, brava, chorona, ou manter (se não deve mudar).
Seja conservador - só mude se realmente fizer sentido.`
                    },
                    { role: 'user', content: message }
                ],
                max_tokens: 10,
                temperature: 0.3
            },
            {
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        const result = response.data.choices[0]?.message?.content?.trim().toLowerCase();
        logger.debug('MOOD', `AI analysis: "${result}"`);

        if (['friendly', 'sage', 'brava', 'chorona'].includes(result)) {
            return result;
        }
        return null;
    } catch (error) {
        logger.debug('MOOD', `AI analysis failed: ${error.message}`);
        return null;
    }
}

function getMoodEmoji(mood) {
    const emojis = { friendly: '🧝‍♀️', sage: '🧙‍♀️', brava: '😤', chorona: '😭' };
    return emojis[mood] || '❓';
}

/**
 * Analisa humor apenas a cada MOOD_ANALYSIS_INTERVAL mensagens; só a IA decide.
 * Sem palavras-chave, sem contador de velha, sem decaimento, sem mensagem de transição.
 */
export async function analyzeMood(channelId, message, options = {}) {
    const state = await getChannelState(channelId, options.guildId);
    const previousMood = state.currentMood;

    state.messagesSinceMoodChange = (state.messagesSinceMoodChange ?? 0) + 1;
    const shouldAnalyze = state.messagesSinceMoodChange >= MOOD_ANALYSIS_INTERVAL;

    if (shouldAnalyze && options.useAI !== false) {
        state.messagesSinceMoodChange = 0;
        const aiMood = await analyzeWithAI(message, previousMood);

        if (aiMood && aiMood !== previousMood) {
            state.currentMood = aiMood;
            state.lastChange = new Date();
            if (!state.stats) state.stats = {};
            state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;

            logger.info('MOOD', `${getMoodEmoji(aiMood)} Humor mudou: ${previousMood} → ${aiMood} (IA)`);
            await saveChannelState(channelId, state);
            channelMoodsCache.set(channelId, state);

            return { mood: aiMood, changed: true };
        }
    }

    if (state.messagesSinceMoodChange % 5 === 0) {
        await saveChannelState(channelId, state);
    }
    channelMoodsCache.set(channelId, state);

    return { mood: state.currentMood, changed: false };
}

/**
 * Get current mood for a channel
 */
export async function getCurrentMood(channelId) {
    const state = await getChannelState(channelId);
    return state.currentMood;
}

/**
 * Force set mood for a channel (for commands like /humor)
 */
export async function setMood(channelId, mood, guildId = null) {
    const state = await getChannelState(channelId);
    const previousMood = state.currentMood;

    state.currentMood = mood;
    state.lastChange = Date.now();
    state.messagesSinceMoodChange = 0;

    await saveChannelState(channelId, state);
    channelMoodsCache.set(channelId, state);

    logger.info('MOOD', `${getMoodEmoji(mood)} Humor forçado: ${previousMood} → ${mood}`);
    return { previousMood, currentMood: mood };
}

export default {
    analyzeMood,
    getCurrentMood,
    setMood
};
