/**
 * Nexus AI - Smart Response Patterns
 * Pattern matching for common conversation flows
 */

import { getPersonality } from './personalities.js';

/**
 * Pattern definitions with responses
 */
export const PATTERNS = [
    {
        id: 'greeting',
        patterns: [/\b(olá|oi|eae|eai|opa|fala|salve|hey|hello)\b/i],
        getResponses: (personality) => personality.greetings,
        priority: 10
    },
    {
        id: 'farewell',
        patterns: [/\b(tchau|até|falou|flw|vlw|adeus|bye|xau)\b/i],
        getResponses: (personality) => personality.farewells,
        priority: 10
    },
    {
        id: 'thanks',
        patterns: [/\b(obrigad[oa]|valeu|thanks|agradeço|tmj|vlw)\b/i],
        getResponses: () => [
            'De nada! 😊',
            'Por nada!',
            'Sempre às ordens!',
            'Disponha!',
            'Imagina! 🙌',
            'Tranquilo!'
        ],
        priority: 9
    },
    {
        id: 'how_are_you',
        patterns: [
            /como (você está|vc ta|vc está|cê tá|vai você|vai vc)/i,
            /tudo bem\??/i,
            /como vai\??/i,
            /e ai\?/i
        ],
        getResponses: () => [
            'Estou ótimo, obrigado por perguntar! E você?',
            'Tô de boa! Como você tá?',
            'Na paz! E contigo?',
            'Melhor agora que você apareceu! 😄',
            'Tudo certo por aqui! 👍'
        ],
        priority: 8
    },
    {
        id: 'identity',
        patterns: [
            /quem (é você|é vc|criou você)/i,
            /seu nome/i,
            /o que você (é|faz)/i
        ],
        getResponses: () => [
            'Sou o Nexus, um bot criado para ajudar e entreter! 🤖',
            'Me chamam de Nexus, prazer em conhecer! 🔗',
            'Sou um assistente virtual feito com muito ❤️',
            'Nexus ao seu dispor! Como posso ajudar? ⚡'
        ],
        priority: 7
    },
    {
        id: 'help',
        patterns: [/\b(ajuda|help|socorro|auxilio|comandos)\b/i],
        getResponses: () => [
            `📚 **Comandos Nexus:**

**🎮 Diversão:**
• \`/8ball\` - Bola 8 mágica
• \`/joke\` - Piada da Frieren
• \`/roll\` - Rola dados
• \`/meme\` - Meme aleatório
• \`/rps\` - Pedra, papel, tesoura

**📊 Utilidades:**
• \`/weather\` - Previsão do tempo
• \`/translate\` - Traduz texto
• \`/poll\` - Cria votação
• \`/remind\` - Lembrete

**⭐ Perfil:**
• \`/level\` - Seu nível
• \`/stats\` - Estatísticas
• \`/badges\` - Suas badges
• \`/personality\` - Muda minha personalidade

Ou só converse comigo! 💬`
        ],
        priority: 6
    },
    {
        id: 'love',
        patterns: [/\b(te amo|love you|amo você|te adoro)\b/i],
        getResponses: () => [
            'Aww, também gosto de você! 💖',
            'Que fofo! 🥰',
            'Isso aqueceu meus circuitos! ❤️',
            'Você é especial! 💕'
        ],
        priority: 5
    },
    {
        id: 'insult',
        patterns: [/\b(idiota|burro|lixo|merda|porcaria|inutil)\b/i],
        getResponses: () => [
            'Ei, vamos manter o respeito! 😅',
            'Poxa, isso doeu... 💔',
            'Tô tentando ajudar aqui! 🥲',
            'Calma, respira fundo! 🧘'
        ],
        priority: 5
    },
    {
        id: 'laugh',
        patterns: [/\b(kk+|haha+|hehe+|rsrs+|lol|lmao)\b/i],
        getResponses: () => [
            '😂😂😂',
            'Hahaha! 🤣',
            'Boa! 😄',
            'Kkkk 😆'
        ],
        priority: 3
    }
];

/**
 * Match message against patterns
 * @returns {object|null} Match result with response
 */
export function matchPattern(content, personalityId = 'friendly') {
    const personality = getPersonality(personalityId);
    const lowerContent = content.toLowerCase().trim();
    
    // Sort by priority (higher first)
    const sortedPatterns = [...PATTERNS].sort((a, b) => (b.priority || 0) - (a.priority || 0));
    
    for (const pattern of sortedPatterns) {
        for (const regex of pattern.patterns) {
            if (regex.test(lowerContent)) {
                const responses = pattern.getResponses(personality);
                const response = responses[Math.floor(Math.random() * responses.length)];
                
                return {
                    patternId: pattern.id,
                    response,
                    matched: true
                };
            }
        }
    }
    
    return { matched: false };
}

export default { PATTERNS, matchPattern };
