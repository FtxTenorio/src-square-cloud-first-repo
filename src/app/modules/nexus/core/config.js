/**
 * Nexus Core - Configuration
 * Centralized configuration for the Nexus module
 */

export const config = {
    // Bot info
    name: 'Nexus',
    version: '2.0.0',
    
    // Discord settings
    discord: {
        prefix: '!', // Legacy prefix (not used with slash commands)
        activityRotation: 5 * 60 * 1000, // 5 minutes
        activities: [
            { name: 'você digitar | /help', type: 'WATCHING' },
            { name: 'seus comandos | /help', type: 'LISTENING' },
            { name: 'com os usuários | /help', type: 'PLAYING' }
        ]
    },
    
    // AI settings
    ai: {
        defaultPersonality: 'friendly',
        maxHistoryMessages: 10,
        openai: {
            model: 'gpt-3.5-turbo',
            maxTokens: 500,
            temperature: 0.8,
            timeout: 30000
        }
    },
    
    // Level/XP settings
    levels: {
        xpPerMessage: { min: 10, max: 25 },
        xpCooldown: 60 * 1000, // 1 minute
        levelUpMultiplier: 100, // XP needed = level * multiplier
        streakBonusMultiplier: 1.5
    },
    
    // Moderation settings
    moderation: {
        warnExpiry: 30 * 24 * 60 * 60 * 1000, // 30 days
        maxWarnsBeforeBan: 5,
        logChannel: 'mod-logs'
    },
    
    // Rate limiting
    rateLimit: {
        commands: {
            windowMs: 60 * 1000, // 1 minute
            maxRequests: 10
        },
        messages: {
            windowMs: 10 * 1000, // 10 seconds
            maxRequests: 5
        }
    },
    
    // Embed colors
    colors: {
        primary: 0x5865F2,    // Discord Blurple
        success: 0x2ecc71,    // Green
        warning: 0xf1c40f,    // Yellow
        error: 0xe74c3c,      // Red
        info: 0x3498db,       // Blue
        xp: 0xffd700,         // Gold
        moderation: 0xe67e22, // Orange
        fun: 0x9b59b6         // Purple
    },
    
    // Emojis
    emojis: {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️',
        loading: '⏳',
        xp: '⭐',
        levelUp: '🎉',
        badge: '🏅',
        coin: '🪙'
    }
};

/**
 * Get nested config value by path
 * @example getConfig('ai.openai.model') => 'gpt-3.5-turbo'
 */
export function getConfig(path, defaultValue = null) {
    const keys = path.split('.');
    let value = config;
    
    for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
            value = value[key];
        } else {
            return defaultValue;
        }
    }
    
    return value;
}

/**
 * Check if feature is enabled
 */
export function isFeatureEnabled(feature) {
    const envKey = `NEXUS_${feature.toUpperCase()}_ENABLED`;
    return process.env[envKey] !== 'false';
}

export default config;
