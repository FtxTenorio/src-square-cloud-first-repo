/**
 * cmdhub - Server Config Model
 * Configurações por servidor (guild): moderação, rate limit, XP, etc.
 * Acesso: validar admin do guild ou ADMIN_KEY.
 */

import mongoose from 'mongoose';

const serverConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },
    modLogChannelId: { type: String, default: null, trim: true },
    xpEnabled: { type: Boolean, default: true },
    rateLimitWindowMs: { type: Number, default: 60 * 1000 },
    rateLimitMax: { type: Number, default: 10 },
    timezoneDefault: { type: String, default: null, trim: true },
    locale: { type: String, default: null, trim: true },
    // Overrides de AI por servidor (opcional; se null usa AppConfig global)
    aiModel: { type: String, default: null, trim: true },
    aiTemperature: { type: Number, default: null },
    aiMaxTokens: { type: Number, default: null }
}, { timestamps: true });

const ServerConfig = mongoose.models.ServerConfig || mongoose.model('ServerConfig', serverConfigSchema);
export default ServerConfig;
