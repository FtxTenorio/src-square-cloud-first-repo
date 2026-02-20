/**
 * Nexus AI - Mood Engine
 * Analyzes conversations and dynamically changes Frieren's mood per channel
 * Persists mood state to MongoDB
 */

import logger from '../utils/logger.js';
import axios from 'axios';
import ChannelMood from '../models/ChannelMood.js';

// In-memory cache (synced with DB)
const channelMoodsCache = new Map();

// Keywords that trigger moods without AI analysis
const MOOD_KEYWORDS = {
    chorona: [
        'himmel', 'saudade', 'perda', 'morreu', 'morte', 'adeus', 
        'despedida', 'sozinha', 'solidão', 'lembranças'
    ],
    sage: [
        'conselho', 'sabedoria', 'filosofia', 'sentido da vida', 
        'por que existimos', 'tempo', 'eternidade', 'ensinamento',
        'o que você aprendeu', 'reflexão'
    ],
    brava: [
        'acorda', 'responde logo', 'anda', 'rápido', 'demora'
    ]
};

// Words that trigger the "velha" counter
const VELHA_TRIGGERS = [
    'velha', 'idosa', 'anciã', 'vovó', 'avó', 'coroa', 
    'tiazinha', 'senhorinha', 'velhinha', 'dinossaura'
];

// Words that trigger forgiveness (reset counters and calm down)
const DESCULPA_TRIGGERS = [
    'desculpa', 'perdão', 'perdoa', 'foi mal', 'me desculpe',
    'sorry', 'desculpe', 'perdoe', 'não quis', 'brincadeira',
    'era brincadeira', 'tava brincando', 'só zoeira'
];

/**
 * Get or create channel mood state (from DB with cache)
 */
async function getChannelState(channelId, guildId = 'DM') {
    // Check cache first
    if (channelMoodsCache.has(channelId)) {
        return channelMoodsCache.get(channelId);
    }
    
    try {
        // Try to find in DB
        let moodDoc = await ChannelMood.findOne({ channelId });
        
        if (!moodDoc) {
            // Create new entry
            moodDoc = await ChannelMood.create({
                channelId,
                guildId,
                currentMood: 'friendly',
                velhaCounter: 0,
                messagesSinceMoodChange: 0
            });
            logger.debug('MOOD', `Novo canal registrado: ${channelId}`);
        }
        
        // Cache it
        const state = {
            currentMood: moodDoc.currentMood,
            velhaCounter: moodDoc.velhaCounter,
            lastChange: moodDoc.lastChange,
            messagesSinceMoodChange: moodDoc.messagesSinceMoodChange,
            stats: moodDoc.stats,
            transitionMessage: null,
            _id: moodDoc._id
        };
        
        channelMoodsCache.set(channelId, state);
        return state;
    } catch (error) {
        logger.error('MOOD', `Erro ao carregar mood do DB: ${error.message}`);
        // Fallback to in-memory
        const fallback = {
            currentMood: 'friendly',
            velhaCounter: 0,
            lastChange: Date.now(),
            messagesSinceMoodChange: 0,
            transitionMessage: null
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
                velhaCounter: state.velhaCounter,
                lastChange: state.lastChange || new Date(),
                messagesSinceMoodChange: state.messagesSinceMoodChange,
                stats: state.stats
            },
            { upsert: true }
        );
    } catch (error) {
        logger.error('MOOD', `Erro ao salvar mood no DB: ${error.message}`);
    }
}

/**
 * Get velha counter for channel
 */
async function getVelhaCounter(channelId) {
    const state = await getChannelState(channelId);
    return state.velhaCounter || 0;
}

/**
 * Check for "velha" triggers and increment counter
 * Works directly with the state object (already loaded)
 * @param {object} state - Channel state object
 * @param {string} message
 */
function checkVelhaTrigger(state, message) {
    // If already in chorona mode, don't bother with the counter
    if (state.currentMood === 'chorona') {
        return { triggered: false, count: 0, alreadyChorona: true };
    }
    
    const lowerMsg = message.toLowerCase();
    
    const hasVelhaTrigger = VELHA_TRIGGERS.some(trigger => lowerMsg.includes(trigger));
    
    if (hasVelhaTrigger) {
        state.velhaCounter = (state.velhaCounter || 0) + 1;
        
        // Update stats
        if (!state.stats) state.stats = {};
        state.stats.timesCalledVelha = (state.stats.timesCalledVelha || 0) + 1;
        
        logger.debug('MOOD', `"Velha" detectado! Contador: ${state.velhaCounter}/3`);
        
        if (state.velhaCounter >= 3) {
            // Reset counter and trigger chorona mode
            state.velhaCounter = 0;
            return { triggered: true, count: 3 };
        }
        
        return { triggered: false, count: state.velhaCounter };
    }
    
    return { triggered: false, count: state.velhaCounter || 0 };
}

/**
 * Get warning message based on velha counter
 */
function getVelhaWarning(count) {
    // Not used anymore - counter is visual instead
    return null;
}

/**
 * Check if user is apologizing
 */
function checkDesculpaTrigger(message) {
    const lowerMsg = message.toLowerCase();
    return DESCULPA_TRIGGERS.some(trigger => lowerMsg.includes(trigger));
}

/**
 * Check for keyword triggers (fast, no AI needed)
 */
function checkKeywordTriggers(message) {
    const lowerMsg = message.toLowerCase();
    
    for (const [mood, keywords] of Object.entries(MOOD_KEYWORDS)) {
        if (keywords.some(keyword => lowerMsg.includes(keyword))) {
            return mood;
        }
    }
    
    return null;
}

/**
 * Analyze mood using GPT-4o-mini (cheap and fast)
 */
async function analyzeWithAI(message, currentMood) {
    const apiKey = process.env.OPENAI_API_KEY;
    
    if (!apiKey) {
        return null;
    }
    
    try {
        const response = await axios.post(
            'https://api.openai.com/v1/chat/completions',
            {
                model: 'gpt-4o-mini', // Cheap model for analysis
                messages: [
                    {
                        role: 'system',
                        content: `Você é um analisador de humor para um bot de Discord inspirado na Frieren.
Analise a mensagem do usuário e decida qual humor a Frieren deveria ter.

Humores disponíveis:
- friendly: Padrão, calma e levemente desapegada
- sage: Reflexiva, filosófica, quando pedem conselhos ou falam de coisas profundas
- brava: Irritada, quando o usuário é impaciente, faz spam, ou é rude
- chorona: Triste, quando mencionam Himmel, perda, saudade, ou coisas que a fazem lembrar do passado

Humor atual: ${currentMood}

Responda APENAS com uma palavra: friendly, sage, brava, chorona, ou manter (se não deve mudar).
Seja conservador - só mude se realmente fizer sentido.`
                    },
                    {
                        role: 'user',
                        content: message
                    }
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
        
        return null; // "manter" or invalid response
    } catch (error) {
        logger.debug('MOOD', `AI analysis failed: ${error.message}`);
        return null;
    }
}

/**
 * Get transition message when mood changes
 * Returns a random message from the available options
 */
function getTransitionMessage(fromMood, toMood, reason) {
    const transitions = {
        'friendly->sage': [
            '*olha para o horizonte pensativa*',
            '*fecha os olhos por um momento*',
            '*o olhar fica distante, contemplativo*',
            '...Isso me fez pensar em algo.'
        ],
        'friendly->brava': [
            '*suspira pesadamente*',
            '*franze levemente a testa*',
            '...Sério?',
            '*o olhar fica mais frio*'
        ],
        'friendly->chorona': [
            '*os olhos ficam distantes*',
            '*o sorriso desaparece lentamente*',
            '...Himmel...',
            '*fica em silêncio por um momento*'
        ],
        'sage->friendly': [
            '*volta ao normal*',
            '*balança a cabeça levemente*',
            '...Enfim.',
            '*suspira suavemente*'
        ],
        'sage->brava': [
            '*franzindo a testa*',
            '*o tom muda sutilmente*',
            '...Você está testando minha paciência.',
            '*para de filosofar abruptamente*'
        ],
        'sage->chorona': [
            '*a voz falha levemente*',
            '*os olhos ficam úmidos*',
            '...O tempo... às vezes dói.',
            '*fica em silêncio*'
        ],
        'brava->friendly': [
            '...Desculpa. Não dormi bem nos últimos 80 anos.',
            '*respira fundo* ...Tudo bem.',
            '...Esquece. Eu exagerei.',
            '*o olhar suaviza*'
        ],
        'brava->sage': [
            '*respira fundo* ...Deixa eu pensar com calma.',
            '*fecha os olhos* ...Talvez você tenha razão.',
            '...Preciso refletir sobre isso.',
            '*a irritação dá lugar à contemplação*'
        ],
        'brava->chorona': [
            '*a raiva se transforma em tristeza*',
            '*os olhos começam a brilhar*',
            '...Por que você tinha que mencionar isso?',
            '*a voz falha*'
        ],
        'chorona->friendly': [
            '*limpa os olhos discretamente* ...Onde estávamos?',
            '*sniff* ...Desculpa. Estou bem agora.',
            '*respira fundo* ...Vamos continuar.',
            '*pisca algumas vezes* ...Enfim.'
        ],
        'chorona->sage': [
            '*com olhos ainda úmidos* ...O tempo me ensinou algo...',
            '*sniff* ...Sabe, depois de mil anos...',
            '*limpa uma lágrima* ...Isso me fez pensar...',
            '*olha para o céu* ...Himmel diria que...'
        ],
        'chorona->brava': [
            '*sniff* ...Mas isso não é desculpa pra você ser rude.',
            '*limpa os olhos* ...Espera, o que você disse?',
            '*a tristeza vira irritação* ...Não abuse.',
            '*sniff* ...Você tá tirando com a minha cara?'
        ]
    };
    
    const key = `${fromMood}->${toMood}`;
    const options = transitions[key];
    
    if (!options || options.length === 0) {
        return null;
    }
    
    // Return random option
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Main mood analysis function
 * Call this before generating a response
 * Persists mood changes to MongoDB
 */
export async function analyzeMood(channelId, message, options = {}) {
    const state = await getChannelState(channelId, options.guildId);
    const previousMood = state.currentMood;
    let moodChanged = false;
    
    // 0. Check for apology first - can calm her down
    if (checkDesculpaTrigger(message)) {
        // Reset velha counter
        if (state.velhaCounter > 0) {
            state.velhaCounter = 0;
            logger.debug('MOOD', `Desculpa aceita! Contador de "velha" resetado`);
        }
        
        // If in a bad mood, go back one step (not directly to friendly)
        if (previousMood === 'chorona') {
            state.currentMood = 'brava'; // chorona -> brava (still a bit upset)
            state.lastChange = new Date();
            state.messagesSinceMoodChange = 0;
            
            const apologyResponses = [
                '*sniff* ...Tá... tá bom. Mas não faz de novo.',
                '*limpa os olhos* ...Ok. Eu aceito suas desculpas.',
                '*sniff* ...Tudo bem... só não me chama assim de novo.',
                '*respirando fundo* ...Certo. Mas você me magoou.'
            ];
            state.transitionMessage = apologyResponses[Math.floor(Math.random() * apologyResponses.length)];
            
            // Update stats
            if (!state.stats) state.stats = {};
            state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;
            
            logger.info('MOOD', `😤 Humor mudou: chorona → brava (desculpa)`);
            
            // Save to DB
            await saveChannelState(channelId, state);
            channelMoodsCache.set(channelId, state);
            
            return {
                mood: 'brava',
                changed: true,
                reason: 'apology',
                transitionMessage: state.transitionMessage,
                velhaCount: 0
            };
        } else if (previousMood === 'brava') {
            state.currentMood = 'friendly';
            state.lastChange = new Date();
            state.messagesSinceMoodChange = 0;
            
            const forgivenResponses = [
                '...Tudo bem. Só não me irrite de novo.',
                '*suspira* ...Ok. Está perdoado.',
                '...Certo. Vou fingir que não aconteceu.',
                '*o olhar suaviza* ...Tá bom. Esquecido.'
            ];
            state.transitionMessage = forgivenResponses[Math.floor(Math.random() * forgivenResponses.length)];
            
            // Update stats
            if (!state.stats) state.stats = {};
            state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;
            
            logger.info('MOOD', `🧝‍♀️ Humor mudou: brava → friendly (desculpa)`);
            
            // Save to DB
            await saveChannelState(channelId, state);
            channelMoodsCache.set(channelId, state);
            
            return {
                mood: 'friendly',
                changed: true,
                reason: 'apology',
                transitionMessage: state.transitionMessage,
                velhaCount: 0
            };
        }
        
        // Already friendly or sage, just acknowledge (save counter reset)
        await saveChannelState(channelId, state);
        
        return {
            mood: previousMood,
            changed: false,
            velhaCount: 0
        };
    }
    
    // 1. Check "velha" trigger (special case with counter)
    const velhaCheck = checkVelhaTrigger(state, message);
    if (velhaCheck.triggered) {
        state.currentMood = 'chorona';
        state.lastChange = new Date();
        state.messagesSinceMoodChange = 0;
        
        const velhaTriggeredMessages = [
            '*os olhos se enchem de lágrimas* ...V-velha...? 😭',
            '*a voz falha* ...Eu não sou... velha... 😭',
            '*começa a chorar* ...Por que vocês humanos são tão cruéis? 😭',
            '*sniff* ...Himmel nunca me chamou assim... 😭',
            '*lágrimas escorrem* ...Mil anos... e é assim que me tratam... 😭'
        ];
        state.transitionMessage = velhaTriggeredMessages[Math.floor(Math.random() * velhaTriggeredMessages.length)];
        
        // Update stats
        if (!state.stats) state.stats = {};
        state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;
        state.stats.timesChorona = (state.stats.timesChorona || 0) + 1;
        
        logger.info('MOOD', `😭 Humor mudou: ${previousMood} → chorona (3x velha)`);
        
        // Save to DB
        await saveChannelState(channelId, state);
        channelMoodsCache.set(channelId, state);
        
        return {
            mood: 'chorona',
            changed: true,
            reason: 'velha_counter',
            transitionMessage: state.transitionMessage,
            velhaCount: 0 // Reset after triggering
        };
    }
    
    // Return current velha count for status tracking
    const currentVelhaCount = velhaCheck.count;
    
    // Save velha counter if it changed
    if (velhaCheck.count > 0) {
        await saveChannelState(channelId, state);
        channelMoodsCache.set(channelId, state);
    }
    
    // 2. Check keyword triggers (fast)
    const keywordMood = checkKeywordTriggers(message);
    if (keywordMood && keywordMood !== previousMood) {
        state.currentMood = keywordMood;
        state.lastChange = new Date();
        state.messagesSinceMoodChange = 0;
        state.transitionMessage = getTransitionMessage(previousMood, keywordMood, 'keyword');
        
        // Update stats
        if (!state.stats) state.stats = {};
        state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;
        if (keywordMood === 'chorona') state.stats.timesChorona = (state.stats.timesChorona || 0) + 1;
        if (keywordMood === 'brava') state.stats.timesBrava = (state.stats.timesBrava || 0) + 1;
        
        logger.info('MOOD', `${getMoodEmoji(keywordMood)} Humor mudou: ${previousMood} → ${keywordMood} (keyword)`);
        
        // Save to DB
        await saveChannelState(channelId, state);
        channelMoodsCache.set(channelId, state);
        
        return {
            mood: keywordMood,
            changed: true,
            reason: 'keyword',
            transitionMessage: state.transitionMessage,
            velhaCount: currentVelhaCount
        };
    }
    
    // 3. Use AI for deeper analysis (only if no keyword match)
    if (options.useAI !== false) {
        const aiMood = await analyzeWithAI(message, previousMood);
        if (aiMood && aiMood !== previousMood) {
            state.currentMood = aiMood;
            state.lastChange = new Date();
            state.messagesSinceMoodChange = 0;
            state.transitionMessage = getTransitionMessage(previousMood, aiMood, 'ai');
            
            // Update stats
            if (!state.stats) state.stats = {};
            state.stats.totalMoodChanges = (state.stats.totalMoodChanges || 0) + 1;
            if (aiMood === 'chorona') state.stats.timesChorona = (state.stats.timesChorona || 0) + 1;
            if (aiMood === 'brava') state.stats.timesBrava = (state.stats.timesBrava || 0) + 1;
            
            logger.info('MOOD', `${getMoodEmoji(aiMood)} Humor mudou: ${previousMood} → ${aiMood} (AI)`);
            
            // Save to DB
            await saveChannelState(channelId, state);
            channelMoodsCache.set(channelId, state);
            
            return {
                mood: aiMood,
                changed: true,
                reason: 'ai_analysis',
                transitionMessage: state.transitionMessage,
                velhaCount: currentVelhaCount
            };
        }
    }
    
    // 4. No change
    state.messagesSinceMoodChange++;
    
    // Decay: after 10 messages, slowly return to friendly
    if (state.currentMood !== 'friendly' && state.messagesSinceMoodChange > 10) {
        state.currentMood = 'friendly';
        state.transitionMessage = getTransitionMessage(previousMood, 'friendly', 'decay');
        state.messagesSinceMoodChange = 0;
        
        logger.debug('MOOD', `Humor decaiu para friendly após 10+ msgs`);
        
        // Save to DB
        await saveChannelState(channelId, state);
        channelMoodsCache.set(channelId, state);
        
        return {
            mood: 'friendly',
            changed: true,
            reason: 'decay',
            transitionMessage: state.transitionMessage,
            velhaCount: currentVelhaCount
        };
    }
    
    // Update message count periodically
    if (state.messagesSinceMoodChange % 5 === 0) {
        await saveChannelState(channelId, state);
    }
    channelMoodsCache.set(channelId, state);
    
    return {
        mood: state.currentMood,
        changed: false,
        velhaCount: currentVelhaCount
    };
}

/**
 * Get current mood for a channel
 */
export async function getCurrentMood(channelId) {
    const state = await getChannelState(channelId);
    return state.currentMood;
}

/**
 * Force set mood for a channel (for commands)
 */
export async function setMood(channelId, mood, guildId = null) {
    const state = await getChannelState(channelId);
    const previousMood = state.currentMood;
    
    state.currentMood = mood;
    state.lastChange = Date.now();
    state.messagesSinceMoodChange = 0;
    state.velhaCounter = 0; // Reset counter on forced mood change
    
    // Persist to database
    await saveChannelState(channelId, state, guildId);
    channelMoodsCache.set(channelId, state);
    
    logger.info('MOOD', `${getMoodEmoji(mood)} Humor forçado: ${previousMood} → ${mood}`);
    
    return { previousMood, currentMood: mood };
}

/**
 * Reset velha counter for a channel
 */
export async function resetVelhaCounter(channelId, guildId = null) {
    const state = await getChannelState(channelId);
    state.velhaCounter = 0;
    
    await saveChannelState(channelId, state, guildId);
    channelMoodsCache.set(channelId, state);
    
    logger.info('MOOD', '🔄 Contador de "velha" resetado');
}

/**
 * Get emoji for mood
 */
function getMoodEmoji(mood) {
    const emojis = {
        friendly: '🧝‍♀️',
        sage: '🧙‍♀️',
        brava: '😤',
        chorona: '😭'
    };
    return emojis[mood] || '❓';
}

export default {
    analyzeMood,
    getCurrentMood,
    setMood,
    resetVelhaCounter
};
