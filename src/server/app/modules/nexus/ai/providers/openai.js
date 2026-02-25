/**
 * Nexus AI - OpenAI Provider
 * Integration with OpenAI API for advanced responses
 */

import axios from 'axios';
import logger from '../../utils/logger.js';

const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';
const DEFAULT_MODEL = 'gpt-3.5-turbo';
const MAX_TOKENS = 500;
const TEMPERATURE = 0.8;

/**
 * Check if OpenAI is configured
 */
export function isConfigured() {
    return !!process.env.OPENAI_API_KEY;
}

/**
 * Generate response using OpenAI
 * @param {string} content - User message
 * @param {object} personality - Personality config
 * @param {array} history - Conversation history
 * @param {object} options - Additional options
 */
export async function generateResponse(content, personality, history = [], options = {}) {
    if (!isConfigured()) {
        throw new Error('OpenAI API key not configured');
    }
    
    const startTime = Date.now();

    // Personalidade como primeira mensagem do sistema (estabelece o padrão)
    const systemContent = personality?.systemPrompt
        ? `${personality.systemPrompt} Responda em português brasileiro. Seja conciso (máximo 2-3 frases para respostas simples).`
        : 'Você é um assistente amigável. Responda em português brasileiro.';
    
    const messages = [
        { role: 'system', content: systemContent },
        // Add conversation history (last 10 messages)
        ...history.slice(-10).map(h => ({
            role: h.role === 'user' ? 'user' : 'assistant',
            content: h.content
        })),
        // Current message
        { role: 'user', content }
    ];
    
    try {
        logger.ai.request('openai', DEFAULT_MODEL);
        
        const { data } = await axios.post(OPENAI_API_URL, {
            model: options.model || DEFAULT_MODEL,
            messages,
            max_tokens: options.maxTokens || MAX_TOKENS,
            temperature: options.temperature || TEMPERATURE
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
    streamResponse
};
