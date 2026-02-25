/**
 * Personality Model
 * Persiste personalidades do bot. O systemPrompt é enviado como primeira
 * mensagem do sistema no array de mensagens da IA (estabelecendo o padrão).
 */

import { createModel } from '../../database/mongodb/model-factory.js';

const Personality = createModel('Personality', {
    slug: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    emoji: {
        type: String,
        default: '🎭'
    },
    description: {
        type: String,
        default: ''
    },
    /** Prompt enviado como primeira mensagem do sistema (role: system) no array da IA */
    systemPrompt: {
        type: String,
        required: true
    },
    /** Personalidades built-in não podem ser removidas */
    isBuiltIn: {
        type: Boolean,
        default: false
    },
    /** Ordem para exibição em listas */
    order: {
        type: Number,
        default: 0
    }
}, {
    indexes: [{ slug: 1 }, { isBuiltIn: 1 }]
});

export default Personality;
