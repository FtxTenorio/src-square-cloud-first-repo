/**
 * cmdhub - App Config Model (singleton)
 * Configurações globais só para admins: AI, feature flags, etc.
 * Documento único: _id = 'app' ou primeiro doc.
 */

import mongoose from 'mongoose';

const appConfigSchema = new mongoose.Schema({
    _id: { type: String, default: 'app' },
    aiModel: { type: String, default: 'gpt-3.5-turbo', trim: true },
    aiTemperature: { type: Number, default: 0.8 },
    aiMaxTokens: { type: Number, default: 500 },
    features: {
        ai: { type: Boolean, default: true },
        levels: { type: Boolean, default: true },
        moderation: { type: Boolean, default: true },
        routines: { type: Boolean, default: true }
    }
}, { timestamps: true, _id: true });

const AppConfig = mongoose.models.AppConfig || mongoose.model('AppConfig', appConfigSchema);
export default AppConfig;
