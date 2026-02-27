/**
 * events - User Preference Model
 * Preferências do usuário (ex.: timezone para rotinas).
 */

import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: null, trim: true },
    // Configurações administrativas por usuário (ex.: IA em DM)
    admin: {
        dmModel: { type: String, default: null, trim: true },
        dmTemperature: { type: Number, default: null },
        dmMaxTokens: { type: Number, default: null }
    }
}, { timestamps: true });

const UserPreference = mongoose.models.UserPreference || mongoose.model('UserPreference', userPreferenceSchema);
export default UserPreference;
