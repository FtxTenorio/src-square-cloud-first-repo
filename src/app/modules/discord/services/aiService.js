/**
 * AI Service - Handles intelligent responses using various AI approaches
 * Supports: OpenAI, local pattern matching, and contextual responses
 */
import logger from './loggerService.js';
import axios from 'axios';

// Personality modes the bot can adopt
const PERSONALITIES = {
    friendly: {
        name: 'Amigável',
        emoji: '😊',
        systemPrompt: 'Você é um assistente amigável e alegre. Responda de forma calorosa e acolhedora.',
        greetings: ['Olá!', 'Oi!', 'E aí!', 'Fala!'],
        farewells: ['Tchau!', 'Até mais!', 'Falou!', 'Até logo!']
    },
    professional: {
        name: 'Profissional',
        emoji: '💼',
        systemPrompt: 'Você é um assistente profissional e formal. Responda de forma clara e objetiva.',
        greetings: ['Bom dia!', 'Olá, como posso ajudar?', 'Às ordens!'],
        farewells: ['Atenciosamente.', 'Estou à disposição.', 'Até breve.']
    },
    funny: {
        name: 'Engraçado',
        emoji: '🤣',
        systemPrompt: 'Você é um comediante. Use humor, piadas e trocadilhos nas respostas.',
        greetings: ['E aíííí!', 'Salve salve!', 'Bora rir?'],
        farewells: ['Falooou!', 'Vai com a graça!', 'Tchau tchau!']
    },
    sage: {
        name: 'Sábio',
        emoji: '🧙‍♂️',
        systemPrompt: 'Você é um sábio milenar. Responda com sabedoria, provérbios e reflexões profundas.',
        greetings: ['Que a paz esteja contigo...', 'Bem-vindo, jovem aprendiz.'],
        farewells: ['Que os ventos te guiem.', 'A jornada continua...']
    },
    pirate: {
        name: 'Pirata',
        emoji: '🏴‍☠️',
        systemPrompt: 'Você é um pirata! Fale como pirata com "arr", "marujo", referências ao mar e tesouros.',
        greetings: ['Arrr, marujo!', 'Ahoy!', 'Bem-vindo a bordo!'],
        farewells: ['Até a próxima aventura!', 'Que os sete mares te guiem!']
    }
};

// User personality preferences (in-memory, should be persisted to DB)
const userPreferences = new Map();

// Smart response patterns
const SMART_PATTERNS = [
    {
        patterns: [/\b(olá|oi|eae|eai|opa|fala|salve)\b/i],
        responses: (personality) => personality.greetings,
        type: 'greeting'
    },
    {
        patterns: [/\b(tchau|até|falou|flw|vlw|adeus|bye)\b/i],
        responses: (personality) => personality.farewells,
        type: 'farewell'
    },
    {
        patterns: [/\b(obrigad[oa]|valeu|thanks|agradeço)\b/i],
        responses: () => ['De nada! 😊', 'Por nada!', 'Sempre às ordens!', 'Disponha!', 'Imagina! 🙌'],
        type: 'thanks'
    },
    {
        patterns: [/como (você está|vc ta|vc está|cê tá|vai você)/i, /tudo bem/i],
        responses: () => [
            'Estou ótimo, obrigado por perguntar! E você?',
            'Tô de boa! Como você tá?',
            'Na paz! E contigo?',
            'Melhor agora que você apareceu! 😄'
        ],
        type: 'how_are_you'
    },
    {
        patterns: [/\b(ajuda|help|socorro|auxilio)\b/i],
        responses: () => [
            '📚 **Comandos disponíveis:**\n' +
            '• `/ping` - Verifica latência\n' +
            '• `/personality` - Muda minha personalidade\n' +
            '• `/stats` - Suas estatísticas\n' +
            '• `/level` - Seu nível atual\n' +
            '• `/weather [cidade]` - Previsão do tempo\n' +
            '• `/translate [texto]` - Traduz texto\n' +
            '• `/poll [pergunta]` - Cria votação\n' +
            '• `/8ball [pergunta]` - Bola 8 mágica\n' +
            '• `/joke` - Conta uma piada\n' +
            '• `/meme` - Gera um meme\n' +
            '• `/roll [dados]` - Rola dados (ex: 2d6)\n' +
            '• `/remind [tempo] [msg]` - Lembrete\n\n' +
            'Ou só converse comigo! 🤖'
        ],
        type: 'help'
    },
    {
        patterns: [/quem (é você|é vc|criou você)/i, /seu nome/i],
        responses: () => [
            'Sou um bot criado para ajudar e entreter! 🤖',
            'Me chamo Square Bot, prazer em conhecer!',
            'Sou um assistente virtual feito com muito ❤️'
        ],
        type: 'identity'
    }
];

// Contextual conversation memory
const conversationContext = new Map();

/**
 * Get or set user personality preference
 */
export function getUserPersonality(userId) {
    return userPreferences.get(userId) || 'friendly';
}

export function setUserPersonality(userId, personality) {
    if (PERSONALITIES[personality]) {
        userPreferences.set(userId, personality);
        return true;
    }
    return false;
}

export function getAvailablePersonalities() {
    return Object.entries(PERSONALITIES).map(([key, value]) => ({
        id: key,
        name: value.name,
        emoji: value.emoji
    }));
}

/**
 * Analyze message sentiment (basic implementation)
 */
function analyzeSentiment(text) {
    const positive = /\b(legal|bom|ótimo|massa|top|incrível|adorei|amei|feliz|obrigad|❤️|😊|🎉|👍)\b/i;
    const negative = /\b(ruim|péssimo|horrível|odeio|triste|raiva|chateado|😢|😠|👎)\b/i;
    const question = /\?$/;
    
    if (positive.test(text)) return 'positive';
    if (negative.test(text)) return 'negative';
    if (question.test(text)) return 'question';
    return 'neutral';
}

/**
 * Generate contextual response based on conversation history
 */
function getContextualResponse(userId, channelId, currentMessage, history) {
    const contextKey = `${userId}-${channelId}`;
    let context = conversationContext.get(contextKey) || { topics: [], messageCount: 0 };
    
    context.messageCount++;
    context.lastMessage = currentMessage;
    context.lastTimestamp = Date.now();
    
    conversationContext.set(contextKey, context);
    
    // After several messages, make more personalized comments
    if (context.messageCount > 5 && context.messageCount % 5 === 0) {
        return {
            addNote: true,
            note: `Já trocamos ${context.messageCount} mensagens! Tô gostando dessa conversa 😄`
        };
    }
    
    return { addNote: false };
}

/**
 * Main AI response generator
 */
export async function generateResponse(message, history = [], options = {}) {
    const userId = message.author?.id || message.userId || 'unknown';
    const channelId = message.channel?.id || message.channelId || 'unknown';
    const content = (message.content || '').toLowerCase().trim();
    const personalityKey = getUserPersonality(userId);
    const personality = PERSONALITIES[personalityKey];
    
    // Check for pattern matches first
    for (const pattern of SMART_PATTERNS) {
        for (const regex of pattern.patterns) {
            if (regex.test(content)) {
                const responses = pattern.responses(personality);
                const response = responses[Math.floor(Math.random() * responses.length)];
                
                // Add contextual note if applicable
                const contextual = getContextualResponse(userId, channelId, content, history);
                if (contextual.addNote) {
                    return `${response}\n\n_${contextual.note}_`;
                }
                
                return response;
            }
        }
    }
    
    // If no pattern matches, generate creative response
    const sentiment = analyzeSentiment(content);
    const contextual = getContextualResponse(userId, channelId, content, history);
    
    // Generate response based on sentiment and personality
    let response = await generateCreativeResponse(content, sentiment, personality, history);
    
    if (contextual.addNote) {
        response += `\n\n_${contextual.note}_`;
    }
    
    return response;
}

/**
 * Generate creative response when no pattern matches
 */
async function generateCreativeResponse(content, sentiment, personality, history) {
    // Try OpenAI if available
    if (process.env.OPENAI_API_KEY) {
        try {
            const startTime = Date.now();
            const response = await callOpenAI(content, personality, history);
            logger.ai.response(response.length, Date.now() - startTime);
            return response;
        } catch (error) {
            logger.ai.error(error);
            // Fallback to local generation
        }
    }
    
    // Local creative responses based on sentiment
    const responses = {
        positive: [
            'Que bom ouvir isso! 🎉',
            'Adoro essa energia positiva!',
            'Isso me deixa feliz também! 😊',
            `${personality.emoji} Isso aí!`
        ],
        negative: [
            'Poxa, sinto muito por isso 😔',
            'Espero que melhore! Tô aqui se precisar.',
            'Força! Vai dar tudo certo 💪',
            'Quer conversar sobre isso?'
        ],
        question: [
            'Hmm, boa pergunta! Deixa eu pensar...',
            'Interessante você perguntar isso!',
            'Essa é uma questão que me faz refletir...'
        ],
        neutral: [
            'Entendi! Me conta mais sobre isso.',
            'Interessante! 🤔',
            'Hmm, faz sentido!',
            'Continua, tô ouvindo! 👂'
        ]
    };
    
    const options = responses[sentiment] || responses.neutral;
    return options[Math.floor(Math.random() * options.length)];
}

/**
 * Call OpenAI API for advanced responses
 */
async function callOpenAI(content, personality, history) {
    const messages = [
        { role: 'system', content: personality.systemPrompt + ' Responda em português brasileiro.' },
        ...history.slice(-10).map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content
        })),
        { role: 'user', content }
    ];
    
    const { data } = await axios.post('https://api.openai.com/v1/chat/completions', {
        model: 'gpt-3.5-turbo',
        messages,
        max_tokens: 500,
        temperature: 0.8
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        }
    });
    
    if (data.error) {
        throw new Error(data.error.message);
    }
    
    return data.choices[0].message.content;
}

/**
 * Extract topics from message for context tracking
 */
export function extractTopics(text) {
    // Simple keyword extraction
    const words = text.toLowerCase().split(/\s+/);
    const stopWords = new Set(['o', 'a', 'os', 'as', 'um', 'uma', 'de', 'da', 'do', 'em', 'para', 'com', 'que', 'e', 'é', 'não', 'sim']);
    
    return words
        .filter(w => w.length > 3 && !stopWords.has(w))
        .slice(0, 5);
}

export default {
    generateResponse,
    getUserPersonality,
    setUserPersonality,
    getAvailablePersonalities,
    extractTopics,
    PERSONALITIES
};
