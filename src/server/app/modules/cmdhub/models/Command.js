/**
 * cmdhub - Command Model
 * MongoDB schema for storing Discord slash commands
 * Enriched with Discord API data
 */

import mongoose from 'mongoose';

const commandSchema = new mongoose.Schema({
    // ═══════════════════════════════════════════════════════════
    // COMMAND IDENTIFICATION
    // ═══════════════════════════════════════════════════════════
    name: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        maxlength: 32
    },
    
    description: {
        type: String,
        required: true,
        maxlength: 100
    },
    
    // Command options (subcommands, arguments, etc)
    options: {
        type: Array,
        default: []
    },
    
    // ═══════════════════════════════════════════════════════════
    // LOCAL METADATA (Our DB)
    // ═══════════════════════════════════════════════════════════
    category: {
        type: String,
        enum: ['utility', 'moderation', 'fun', 'ai', 'custom', 'system'],
        default: 'custom'
    },
    
    enabled: {
        type: Boolean,
        default: true
    },
    
    // Guild-specific or global (null = global)
    guildId: {
        type: String,
        default: null
    },
    
    // Permissions
    defaultMemberPermissions: {
        type: String,
        default: null
    },
    
    dmPermission: {
        type: Boolean,
        default: false
    },
    
    // Our versioning
    version: {
        type: Number,
        default: 1
    },
    
    // Audit trail
    createdBy: {
        type: String,
        default: 'system'
    },
    
    updatedBy: {
        type: String,
        default: 'system'
    },
    
    // ═══════════════════════════════════════════════════════════
    // DISCORD API DATA (Synced from Discord)
    // ═══════════════════════════════════════════════════════════
    discord: {
        // Command ID from Discord API
        id: {
            type: String,
            default: null
        },
        
        // Application ID that owns this command
        applicationId: {
            type: String,
            default: null
        },
        
        // Discord's command version (snowflake)
        version: {
            type: String,
            default: null
        },
        
        // Type: 1 = CHAT_INPUT, 2 = USER, 3 = MESSAGE
        type: {
            type: Number,
            default: 1
        },
        
        // NSFW flag
        nsfw: {
            type: Boolean,
            default: false
        },
        
        // Integration types
        integrationTypes: {
            type: Array,
            default: []
        },
        
        // Contexts where command is available
        contexts: {
            type: Array,
            default: null
        },
        
        // Handler type
        handler: {
            type: Number,
            default: null
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // DEPLOYMENT STATUS
    // ═══════════════════════════════════════════════════════════
    deployment: {
        status: {
            type: String,
            enum: ['pending', 'deployed', 'failed', 'outdated', 'synced'],
            default: 'pending'
        },
        
        lastDeployed: {
            type: Date,
            default: null
        },
        
        lastSynced: {
            type: Date,
            default: null
        },
        
        lastError: {
            type: String,
            default: null
        },
        
        deployCount: {
            type: Number,
            default: 0
        }
    },
    
    // ═══════════════════════════════════════════════════════════
    // USAGE STATISTICS
    // ═══════════════════════════════════════════════════════════
    stats: {
        totalUses: {
            type: Number,
            default: 0
        },
        
        lastUsed: {
            type: Date,
            default: null
        },
        
        usesToday: {
            type: Number,
            default: 0
        },
        
        // Per-guild usage
        guildUsage: {
            type: Map,
            of: Number,
            default: {}
        }
    }
}, {
    timestamps: true
});

// ═══════════════════════════════════════════════════════════
// INDEXES
// ═══════════════════════════════════════════════════════════
commandSchema.index({ name: 1, guildId: 1 }, { unique: true });
commandSchema.index({ category: 1 });
commandSchema.index({ enabled: 1 });
commandSchema.index({ guildId: 1 });
commandSchema.index({ 'deployment.status': 1 });
commandSchema.index({ 'discord.id': 1 });
commandSchema.index({ 'stats.totalUses': -1 });

// ═══════════════════════════════════════════════════════════
// METHODS
// ═══════════════════════════════════════════════════════════

/**
 * Transform to Discord API format for deployment
 */
commandSchema.methods.toDiscordAPI = function() {
    const data = {
        name: this.name,
        description: this.description,
        type: this.discord?.type || 1
    };
    
    if (this.options?.length > 0) {
        data.options = this.options;
    }
    
    if (this.defaultMemberPermissions) {
        data.default_member_permissions = this.defaultMemberPermissions;
    }
    
    if (this.dmPermission !== undefined) {
        data.dm_permission = this.dmPermission;
    }
    
    if (this.discord?.nsfw) {
        data.nsfw = this.discord.nsfw;
    }
    
    return data;
};

/**
 * Update from Discord API response
 */
commandSchema.methods.syncFromDiscord = function(discordData) {
    this.discord = {
        id: discordData.id,
        applicationId: discordData.application_id,
        version: discordData.version,
        type: discordData.type,
        nsfw: discordData.nsfw || false,
        integrationTypes: discordData.integration_types || [],
        contexts: discordData.contexts || null,
        handler: discordData.handler || null
    };
    
    this.deployment.status = 'synced';
    this.deployment.lastSynced = new Date();
    
    return this;
};

/**
 * Increment usage stats
 */
commandSchema.methods.recordUsage = async function(guildId = null) {
    this.stats.totalUses += 1;
    this.stats.lastUsed = new Date();
    this.stats.usesToday += 1;
    
    if (guildId) {
        const currentGuildCount = this.stats.guildUsage?.get(guildId) || 0;
        this.stats.guildUsage.set(guildId, currentGuildCount + 1);
    }
    
    return this.save();
};

/**
 * Check if command needs redeployment
 */
commandSchema.methods.needsRedeploy = function() {
    return !this.discord?.id || 
           this.deployment.status === 'pending' || 
           this.deployment.status === 'outdated' ||
           this.deployment.status === 'failed';
};

// ═══════════════════════════════════════════════════════════
// STATICS
// ═══════════════════════════════════════════════════════════

/**
 * Get all enabled commands for deployment
 */
commandSchema.statics.getDeployableCommands = function() {
    return this.find({ 
        enabled: true,
        $or: [
            { 'deployment.status': 'pending' },
            { 'deployment.status': 'outdated' },
            { 'deployment.status': 'failed' }
        ]
    });
};

/**
 * Get commands by category
 */
commandSchema.statics.getByCategory = function(category) {
    return this.find({ category, enabled: true });
};

/**
 * Get top used commands
 */
commandSchema.statics.getTopCommands = function(limit = 10) {
    return this.find({ enabled: true })
        .sort({ 'stats.totalUses': -1 })
        .limit(limit);
};

const Command = mongoose.model('Command', commandSchema);

export default Command;
