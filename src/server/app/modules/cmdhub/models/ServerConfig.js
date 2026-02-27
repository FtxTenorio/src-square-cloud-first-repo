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
    locale: { type: String, default: null, trim: true }
}, { timestamps: true });

const ServerConfig = mongoose.models.ServerConfig || mongoose.model('ServerConfig', serverConfigSchema);
export default ServerConfig;
