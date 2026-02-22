/**
 * events (Life-Sync Engine) - Routine Model
 * MongoDB blueprint for scheduled routines (checklist + conditions).
 * @see docs: The Adaptive Life-Sync Engine - Hybrid Orchestration Loop
 */

import mongoose from 'mongoose';

const routineSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true },
    guildId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 100 },
    cron: { type: String, required: true, trim: true },
    timezone: { type: String, required: true, default: 'Europe/London', trim: true },
    items: {
        type: [{
            label: { type: String, required: true },
            condition: { type: String, default: 'always' }
        }],
        default: []
    },
    enabled: { type: Boolean, default: true },
    scheduleId: { type: String, default: null }
}, { timestamps: true });

const Routine = mongoose.models.Routine || mongoose.model('Routine', routineSchema);
export default Routine;
