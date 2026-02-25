/**
 * Server Model
 * Informações do servidor Discord (guild).
 * Um servidor pode ter múltiplos chats/canais.
 */

import { createModel } from '../../database/mongodb/model-factory.js';

const Server = createModel('Server', {
    guildId: {
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
    // Informações adicionais (opcional, para cache)
    memberCount: { type: Number, default: null },
    iconUrl: { type: String, default: null }
}, {
    indexes: [{ guildId: 1 }]
});

export default Server;
