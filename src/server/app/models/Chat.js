/**
 * Chat Model
 * Informações do canal de chat. Relacionado ao Server (guild).
 * Cada chat tem uma personalidade associada.
 */

import { createModel } from '../../database/mongodb/model-factory.js';

const Chat = createModel('Chat', {
    channelId: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    guildId: {
        type: String,
        required: true,
        index: true
    },
    name: {
        type: String,
        trim: true,
        default: ''
    },
    // Referência à personalidade (ObjectId ou id da personalidade)
    personalityId: {
        type: String,
        required: true,
        index: true,
        default: 'friendly'
    }
}, {
    indexes: [
        { guildId: 1, channelId: 1 },
        { personalityId: 1 }
    ]
});

export default Chat;
