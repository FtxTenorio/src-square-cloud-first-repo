/**
 * Nexus AI - OpenAI Provider
 * Integration with OpenAI API for advanced responses
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.8;

/**
 * Check if OpenAI is configured
 */
export function isConfigured() {
    return !!process.env.OPENAI_API_KEY;
}

const HISTORY_LIMIT = 50;

/**
 * Formata conteúdo para a IA enxergar o chat: [Nome]: mensagem
 */
function formatMessageContent(h) {
    const name = h.username;
    const text = h.content || '';
    if (name) return `[${name}]: ${text}`.trim();
    return text;
}

/**
 * Generate response using OpenAI
 * @param {string} content - User message
 * @param {object} personality - Personality config
 * @param {array} history - Conversation history (até 50 msgs do canal, com role/content/username)
 * @param {object} options - { currentUsername, model, maxTokens, temperature }
 */
export async function generateResponse(content, personality, history = [], options = {}) {
    if (!isConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const startTime = Date.now();
    const currentUsername = options.currentUsername;

    const systemBase = personality?.systemPrompt
        ? `${personality.systemPrompt} Responda em português brasileiro. Seja conciso (máximo 2-3 frases para respostas simples).`
        : 'Você é um assistente amigável. Responda em português brasileiro.';
    const systemContent = `${systemBase}\n\nContexto: as mensagens abaixo são as últimas do canal (formato [Nome]: mensagem). Use esse contexto para responder de forma coerente ao que está sendo dito no chat.\n\nIMPORTANTE:. Responda apenas com o texto da Frieren, direto, sem prefixos nem citações de outras mensagens.`;

    // Histórico do canal: últimas 50 mensagens (todos os usuários + bot), com [Nome]: mensagem
    const historyMessages = history.slice(-HISTORY_LIMIT).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: formatMessageContent(h)
    }));

    const currentContent = currentUsername
        ? `[${currentUsername}]: ${content}`.trim()
        : content;

    const messages = [
        { role: 'system', content: systemContent },
        ...historyMessages,
        { role: 'user', content: currentContent }
    ];
    
    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens ?? MAX_TOKENS;
    const temperature = options.temperature ?? TEMPERATURE;

    try {
        logger.ai.request('openai', model);

        const { data } = await axios.post(OPENAI_API_URL, {
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        }, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            timeout: 30000 // 30 second timeout
        });
        
        if (data.error) {
            throw new Error(data.error.message);
        }
        
        const response = data.choices[0].message.content;
        const elapsed = Date.now() - startTime;
        
        logger.ai.response(response.length, elapsed);
        
        return {
            content: response,
            provider: 'openai',
            model: data.model,
            usage: data.usage,
            elapsed
        };
    } catch (error) {
        logger.ai.error(error);
        throw error;
    }
}

const MAX_TOOL_ROUNDS = 5;

/**
 * Generate response with optional tools (function calling). Used in DM for routine tools.
 * @param {string} content - User message
 * @param {object} personality - Personality config
 * @param {array} history - Conversation history
 * @param {object} options - { currentUsername, model, maxTokens, temperature, tools, executeTool(userId, name, args, context), messageContext }
 */
export async function generateResponseWithTools(content, personality, history = [], options = {}) {
    if (!isConfigured()) {
        throw new Error('OpenAI API key not configured');
    }

    const currentUsername = options.currentUsername;
    const userId = options.userId;
    const tools = options.tools;
    const executeTool = options.executeTool;

    const systemBase = personality?.systemPrompt
        ? `${personality.systemPrompt} Responda em português brasileiro. Seja concisa.`
        : 'Você é um assistente amigável. Responda em português brasileiro.';
    const systemContent = tools?.length
        ? `${systemBase}\n\nVocê tem acesso a ferramentas para criar, listar, ver detalhes, atualizar e apagar rotinas (create_routine, list_routines, get_routine, update_routine, delete_routine). Quando usar list_routines ou get_routine, o resultado já foi enviado ao usuário em um embed no Discord. Nesse caso, responda APENAS com uma frase curta (ex: "Pronto!", "Aqui estão.") — NÃO repita lista, blocos (├ └), nomes de rotinas nem horários. Para create/update/delete, confirme em uma frase.`
        : systemBase;
    const systemWithContext = `${systemContent}\n\nContexto: as mensagens abaixo são as últimas da conversa. NÃO use formato [Nome]: na sua resposta; responda direto como Frieren.`;

    const historyMessages = history.slice(-HISTORY_LIMIT).map(h => ({
        role: h.role === 'user' ? 'user' : 'assistant',
        content: formatMessageContent(h)
    }));

    const currentContent = currentUsername ? `[${currentUsername}]: ${content}`.trim() : content;

    let messages = [
        { role: 'system', content: systemWithContext },
        ...historyMessages,
        { role: 'user', content: currentContent }
    ];

    const model = options.model || DEFAULT_MODEL;
    const maxTokens = options.maxTokens ?? MAX_TOKENS;
    const temperature = options.temperature ?? TEMPERATURE;

    const startTime = Date.now();
    let round = 0;

    while (round < MAX_TOOL_ROUNDS) {
        round++;
        const body = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature
        };
        if (tools?.length) body.tools = tools;

        logger.ai.request('openai', model, round > 1 ? ` (tool round ${round})` : '');

        const { data } = await axios.post(OPENAI_API_URL, body, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
            },
            timeout: 60000
        });

        if (data.error) throw new Error(data.error.message);

        const choice = data.choices[0];
        if (!choice) throw new Error('No choice in OpenAI response');

        const message = choice.message;
        const toolCalls = message.tool_calls;

        if (!toolCalls?.length) {
            const text = message.content || '';
            const elapsed = Date.now() - startTime;
            logger.ai.response(text.length, elapsed);
            return {
                content: text,
                provider: 'openai',
                model: data.model,
                usage: data.usage,
                elapsed
            };
        }

        messages.push({
            role: 'assistant',
            content: message.content || null,
            tool_calls: toolCalls.map(tc => ({
                id: tc.id,
                type: 'function',
                function: { name: tc.function?.name, arguments: tc.function?.arguments || '{}' }
            }))
        });

        for (const tc of toolCalls) {
            const name = tc.function?.name;
            let args = {};
            try {
                args = typeof tc.function?.arguments === 'string' ? JSON.parse(tc.function.arguments) : {};
            } catch {
                args = {};
            }
            const result = executeTool && userId
                ? await executeTool(userId, name, args, options.messageContext || {})
                : JSON.stringify({ error: 'Tool executor not available' });
            messages.push({
                role: 'tool',
                tool_call_id: tc.id,
                content: typeof result === 'string' ? result : JSON.stringify(result)
            });
        }
    }

    const elapsed = Date.now() - startTime;
    logger.ai.response(0, elapsed);
    return {
        content: 'Desculpe, passei por muitas etapas de ferramentas. Pode repetir o que precisava?',
        provider: 'openai',
        elapsed
    };
}

/**
 * Stream response from OpenAI (for long responses)
 */
export async function streamResponse(content, personality, history = [], onChunk) {
    if (!isConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const systemContent = personality?.systemPrompt
        ? `${personality.systemPrompt} Responda em português brasileiro.`
        : 'Você é um assistente amigável. Responda em português brasileiro.';
    
    const messages = [
        { role: 'system', content: systemContent },
        ...history.slice(-10).map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content
        })),
        { role: 'user', content }
    ];
    
    const response = await axios.post(OPENAI_API_URL, {
        model: DEFAULT_MODEL,
        messages,
        max_tokens: MAX_TOKENS,
        temperature: TEMPERATURE,
        stream: true
    }, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`
        },
        responseType: 'stream'
    });
    
    let fullContent = '';
    
    return new Promise((resolve, reject) => {
        response.data.on('data', (chunk) => {
            const lines = chunk.toString().split('\n').filter(line => line.trim());
            
            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') {
                        resolve({ content: fullContent, provider: 'openai' });
                        return;
                    }
                    
                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices[0]?.delta?.content;
                        if (content) {
                            fullContent += content;
                            if (onChunk) onChunk(content);
                        }
                    } catch (e) {
                        // Skip parse errors
                    }
                }
            }
        });
        
        response.data.on('error', reject);
    });
}

export default {
    isConfigured,
    generateResponse,
    generateResponseWithTools,
    streamResponse
};
