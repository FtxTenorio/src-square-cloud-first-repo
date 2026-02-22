/**
 * events - User Preference Model
 * Preferências do usuário (ex.: timezone para rotinas).
 */

import mongoose from 'mongoose';

const userPreferenceSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: null, trim: true }
}, { timestamps: true });

const UserPreference = mongoose.models.UserPreference || mongoose.model('UserPreference', userPreferenceSchema);
export default UserPreference;
