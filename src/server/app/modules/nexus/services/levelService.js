/**
 * Level/XP System - Gamification for Discord users
 */
import mongoose from 'mongoose';

// Level schema for MongoDB
const levelSchema = new mongoose.Schema({
    odId: { type: String, required: true },
    guildId: { type: String, required: true },
    username: { type: String, required: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    totalMessages: { type: Number, default: 0 },
    lastMessageAt: { type: Date },
    badges: [{ 
        id: String, 
        name: String, 
        emoji: String, 
        earnedAt: Date 
    }],
    streak: {
        current: { type: Number, default: 0 },
        longest: { type: Number, default: 0 },
        lastActiveDate: String
    }
}, { timestamps: true });

// Compound index for guild leaderboards
levelSchema.index({ guildId: 1, xp: -1 });
levelSchema.index({ odId: 1, guildId: 1 }, { unique: true });

const UserLevel = mongoose.models.UserLevel || mongoose.model('UserLevel', levelSchema);

// XP configuration
const XP_CONFIG = {
    messageXP: { min: 10, max: 25 },           // XP per message
    voiceXP: 5,                                 // XP per minute in voice
    reactionXP: 2,                              // XP for reacting
    cooldown: 60000,                            // 1 minute cooldown between XP gains
    levelMultiplier: 1.5,                       // XP needed increases by this each level
    baseXP: 100                                 // Base XP needed for level 2
};

// Badges definitions
const BADGES = {
    first_message: { id: 'first_message', name: 'Primeira Mensagem', emoji: '👋', description: 'Enviou sua primeira mensagem' },
    chatterbox: { id: 'chatterbox', name: 'Tagarela', emoji: '💬', description: 'Enviou 100 mensagens' },
    veteran: { id: 'veteran', name: 'Veterano', emoji: '🎖️', description: 'Enviou 1000 mensagens' },
    night_owl: { id: 'night_owl', name: 'Coruja', emoji: '🦉', description: 'Ativo às 3h da manhã' },
    early_bird: { id: 'early_bird', name: 'Madrugador', emoji: '🐦', description: 'Ativo às 6h da manhã' },
    streak_3: { id: 'streak_3', name: 'Em Chamas', emoji: '🔥', description: '3 dias seguidos de atividade' },
    streak_7: { id: 'streak_7', name: 'Semana Perfeita', emoji: '⭐', description: '7 dias seguidos' },
    streak_30: { id: 'streak_30', name: 'Dedicação', emoji: '💎', description: '30 dias seguidos' },
    level_5: { id: 'level_5', name: 'Aprendiz', emoji: '📚', description: 'Alcançou nível 5' },
    level_10: { id: 'level_10', name: 'Experiente', emoji: '🏆', description: 'Alcançou nível 10' },
    level_25: { id: 'level_25', name: 'Mestre', emoji: '👑', description: 'Alcançou nível 25' },
    level_50: { id: 'level_50', name: 'Lenda', emoji: '🌟', description: 'Alcançou nível 50' },
    helper: { id: 'helper', name: 'Ajudante', emoji: '🤝', description: 'Ajudou outros usuários' }
};

// Cooldown tracking (in-memory)
const cooldowns = new Map();

/**
 * Calculate XP needed for a specific level
 */
function xpForLevel(level) {
    return Math.floor(XP_CONFIG.baseXP * Math.pow(XP_CONFIG.levelMultiplier, level - 1));
}

/**
 * Calculate total XP needed to reach a level
 */
function totalXpForLevel(level) {
    let total = 0;
    for (let i = 1; i < level; i++) {
        total += xpForLevel(i);
    }
    return total;
}

/**
 * Calculate level from total XP
 */
function calculateLevel(totalXP) {
    let level = 1;
    let xpNeeded = 0;
    
    while (totalXP >= xpNeeded + xpForLevel(level)) {
        xpNeeded += xpForLevel(level);
        level++;
    }
    
    return { level, currentXP: totalXP - xpNeeded, neededXP: xpForLevel(level) };
}

/**
 * Check and award badges based on current stats
 */
function checkBadges(userData) {
    const newBadges = [];
    const existingBadgeIds = new Set(userData.badges.map(b => b.id));
    
    const hour = new Date().getHours();
    const checks = [
        { condition: userData.totalMessages === 1, badge: BADGES.first_message },
        { condition: userData.totalMessages >= 100, badge: BADGES.chatterbox },
        { condition: userData.totalMessages >= 1000, badge: BADGES.veteran },
        { condition: hour >= 2 && hour <= 4, badge: BADGES.night_owl },
        { condition: hour >= 5 && hour <= 7, badge: BADGES.early_bird },
        { condition: userData.streak.current >= 3, badge: BADGES.streak_3 },
        { condition: userData.streak.current >= 7, badge: BADGES.streak_7 },
        { condition: userData.streak.current >= 30, badge: BADGES.streak_30 },
        { condition: userData.level >= 5, badge: BADGES.level_5 },
        { condition: userData.level >= 10, badge: BADGES.level_10 },
        { condition: userData.level >= 25, badge: BADGES.level_25 },
        { condition: userData.level >= 50, badge: BADGES.level_50 }
    ];
    
    for (const { condition, badge } of checks) {
        if (condition && !existingBadgeIds.has(badge.id)) {
            newBadges.push({ ...badge, earnedAt: new Date() });
        }
    }
    
    return newBadges;
}

/**
 * Update streak for user
 */
function updateStreak(userData) {
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (userData.streak.lastActiveDate === today) {
        // Already active today
        return;
    }
    
    if (userData.streak.lastActiveDate === yesterday) {
        // Continue streak
        userData.streak.current++;
        if (userData.streak.current > userData.streak.longest) {
            userData.streak.longest = userData.streak.current;
        }
    } else {
        // Reset streak
        userData.streak.current = 1;
    }
    
    userData.streak.lastActiveDate = today;
}

/**
 * Add XP to user (from message)
 */
export async function addMessageXP(message) {
    const odId = message.author.id;
    const guildId = message.guild?.id || 'DM';
    const cooldownKey = `${odId}-${guildId}`;
    
    // Check cooldown
    const now = Date.now();
    const lastXP = cooldowns.get(cooldownKey) || 0;
    
    if (now - lastXP < XP_CONFIG.cooldown) {
        return null; // On cooldown
    }
    
    cooldowns.set(cooldownKey, now);
    
    // Random XP within range
    const xpGained = Math.floor(
        Math.random() * (XP_CONFIG.messageXP.max - XP_CONFIG.messageXP.min + 1) + 
        XP_CONFIG.messageXP.min
    );
    
    // Find or create user
    let userData = await UserLevel.findOne({ odId, guildId });
    
    if (!userData) {
        userData = new UserLevel({
            odId,
            guildId,
            username: message.author.username,
            xp: 0,
            level: 1,
            totalMessages: 0,
            badges: [],
            streak: { current: 0, longest: 0, lastActiveDate: null }
        });
    }
    
    // Update stats
    const oldLevel = userData.level;
    userData.xp += xpGained;
    userData.totalMessages++;
    userData.username = message.author.username;
    userData.lastMessageAt = new Date();
    
    // Update streak
    updateStreak(userData);
    
    // Calculate new level
    const levelInfo = calculateLevel(userData.xp);
    userData.level = levelInfo.level;
    
    // Check for new badges
    const newBadges = checkBadges(userData);
    if (newBadges.length > 0) {
        userData.badges.push(...newBadges);
    }
    
    await userData.save();
    
    return {
        xpGained,
        totalXP: userData.xp,
        level: userData.level,
        leveledUp: userData.level > oldLevel,
        oldLevel,
        currentXP: levelInfo.currentXP,
        neededXP: levelInfo.neededXP,
        newBadges,
        streak: userData.streak.current
    };
}

/**
 * Get user stats
 */
export async function getUserStats(odId, guildId) {
    const userData = await UserLevel.findOne({ odId, guildId });
    
    if (!userData) {
        return null;
    }
    
    const levelInfo = calculateLevel(userData.xp);
    const rank = await UserLevel.countDocuments({ 
        guildId, 
        xp: { $gt: userData.xp } 
    }) + 1;
    
    return {
        username: userData.username,
        level: userData.level,
        xp: userData.xp,
        currentXP: levelInfo.currentXP,
        neededXP: levelInfo.neededXP,
        progress: Math.round((levelInfo.currentXP / levelInfo.neededXP) * 100),
        totalMessages: userData.totalMessages,
        badges: userData.badges,
        streak: userData.streak,
        rank
    };
}

/**
 * Get server leaderboard
 */
export async function getLeaderboard(guildId, limit = 10) {
    const users = await UserLevel.find({ guildId })
        .sort({ xp: -1 })
        .limit(limit)
        .lean();
    
    return users.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        level: user.level,
        xp: user.xp,
        badges: user.badges?.length || 0
    }));
}

/**
 * Create progress bar visual
 */
export function createProgressBar(current, max, length = 10) {
    const filled = Math.round((current / max) * length);
    const empty = length - filled;
    return '█'.repeat(filled) + '░'.repeat(empty);
}

/**
 * Format level card message
 */
export function formatLevelCard(stats) {
    const progressBar = createProgressBar(stats.currentXP, stats.neededXP, 15);
    const badgesStr = stats.badges.map(b => b.emoji).join(' ') || 'Nenhuma';
    
    return `
📊 **${stats.username}** - Rank #${stats.rank}

🎯 **Nível ${stats.level}**
${progressBar} ${stats.progress}%
\`${stats.currentXP}/${stats.neededXP} XP\`

💬 Mensagens: ${stats.totalMessages}
🔥 Streak: ${stats.streak.current} dias (Recorde: ${stats.streak.longest})

🏅 **Badges:** ${badgesStr}
    `.trim();
}

export default {
    addMessageXP,
    getUserStats,
    getLeaderboard,
    createProgressBar,
    formatLevelCard,
    BADGES,
    xpForLevel,
    calculateLevel
};
