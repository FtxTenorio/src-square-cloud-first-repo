/**
 * Nexus AI - Sentiment Analysis
 * Analyze message sentiment for appropriate responses
 */

// Sentiment keywords
const POSITIVE_WORDS = [
    'legal', 'bom', 'ótimo', 'massa', 'top', 'incrível', 'adorei', 'amei',
    'feliz', 'obrigad', 'maravilh', 'perfeito', 'excelente', 'demais',
    'show', 'sensacional', 'fantástico', 'animal', 'foda', 'maneiro'
];

const NEGATIVE_WORDS = [
    'ruim', 'péssimo', 'horrível', 'odeio', 'triste', 'raiva', 'chateado',
    'merda', 'droga', 'porcaria', 'terrível', 'nojo', 'irritado', 'bravo',
    'decepcionado', 'frustrado', 'cansado', 'estressado'
];

const POSITIVE_EMOJIS = ['❤️', '😊', '🎉', '👍', '💖', '🥰', '😄', '🙌', '✨', '💕', '😁', '🔥'];
const NEGATIVE_EMOJIS = ['😢', '😠', '👎', '💔', '😭', '😡', '🤬', '😤', '😞', '😔'];

/**
 * Analyze sentiment of text
 * @returns {'positive' | 'negative' | 'question' | 'neutral'}
 */
export function analyzeSentiment(text) {
    const lowerText = text.toLowerCase();
    
    // Check for question
    if (/\?$/.test(text.trim()) || /^(o que|como|quando|onde|por que|quem|qual)/i.test(text)) {
        return 'question';
    }
    
    // Count positive indicators
    let positiveScore = 0;
    for (const word of POSITIVE_WORDS) {
        if (lowerText.includes(word)) positiveScore++;
    }
    for (const emoji of POSITIVE_EMOJIS) {
        if (text.includes(emoji)) positiveScore += 2;
    }
    
    // Count negative indicators
    let negativeScore = 0;
    for (const word of NEGATIVE_WORDS) {
        if (lowerText.includes(word)) negativeScore++;
    }
    for (const emoji of NEGATIVE_EMOJIS) {
        if (text.includes(emoji)) negativeScore += 2;
    }
    
    // Determine sentiment
    if (positiveScore > negativeScore && positiveScore > 0) {
        return 'positive';
    }
    if (negativeScore > positiveScore && negativeScore > 0) {
        return 'negative';
    }
    
    return 'neutral';
}

/**
 * Get sentiment-based responses
 */
export function getSentimentResponses(sentiment, personalityEmoji = '😊') {
    const responses = {
        positive: [
            'Que bom ouvir isso! 🎉',
            'Adoro essa energia positiva!',
            'Isso me deixa feliz também! 😊',
            `${personalityEmoji} Isso aí!`,
            'Maravilha! 🌟',
            'Fico feliz em saber! ✨'
        ],
        negative: [
            'Poxa, sinto muito por isso 😔',
            'Espero que melhore! Tô aqui se precisar.',
            'Força! Vai dar tudo certo 💪',
            'Quer conversar sobre isso?',
            'Posso ajudar em algo? 🤝',
            'Não desanima, vai ficar tudo bem! 🌈'
        ],
        question: [
            'Hmm, boa pergunta! Deixa eu pensar...',
            'Interessante você perguntar isso!',
            'Essa é uma questão que me faz refletir...',
            'Deixa eu ver... 🤔',
            'Boa pergunta! 💭'
        ],
        neutral: [
            'Entendi! Me conta mais sobre isso.',
            'Interessante! 🤔',
            'Hmm, faz sentido!',
            'Continua, tô ouvindo! 👂',
            'Certo, entendi! 📝',
            'Ah, legal! 😊'
        ]
    };
    
    const options = responses[sentiment] || responses.neutral;
    return options[Math.floor(Math.random() * options.length)];
}

export default { analyzeSentiment, getSentimentResponses };
