/**
 * cmdhub - Rate Limiter Service
 * Uses Redis to limit command updates to 3 per hour
 */

import redis from '../../../../database/redis/index.js';
import logger from '../../nexus/utils/logger.js';

const RATE_LIMIT_PREFIX = 'cmdhub:ratelimit:';
const MAX_ATTEMPTS = 5;
const WINDOW_TTL = 3600; // 1 hour in seconds

/**
 * Check if rate limit allows the action
 * @param {string} action - Action identifier (e.g., 'deploy', 'update:commandName')
 * @param {string} identifier - User or system identifier
 * @returns {Promise<{allowed: boolean, remaining: number, resetIn: number}>}
 */
export async function checkRateLimit(action, identifier = 'system') {
    const key = `${RATE_LIMIT_PREFIX}${action}:${identifier}`;
    
    try {
        // Get current count
        const current = await redis.get(key);
        const count = current ? parseInt(current, 10) : 0;
        
        // Get TTL
        const ttl = await redis.ttl(key);
        const resetIn = ttl > 0 ? ttl : WINDOW_TTL;
        
        if (count >= MAX_ATTEMPTS) {
            logger.warn('CMDHUB', `⛔ Rate limit atingido: ${action} (${identifier})`);
            return {
                allowed: false,
                remaining: 0,
                resetIn,
                message: `Rate limit atingido. Tente novamente em ${Math.ceil(resetIn / 60)} minutos.`
            };
        }
        
        return {
            allowed: true,
            remaining: MAX_ATTEMPTS - count,
            resetIn
        };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao verificar rate limit', error.message);
        // On Redis error, allow the action (fail-open)
        return { allowed: true, remaining: MAX_ATTEMPTS, resetIn: WINDOW_TTL };
    }
}

/**
 * Increment rate limit counter
 * @param {string} action - Action identifier
 * @param {string} identifier - User or system identifier
 * @returns {Promise<{count: number, remaining: number}>}
 */
export async function incrementRateLimit(action, identifier = 'system') {
    const key = `${RATE_LIMIT_PREFIX}${action}:${identifier}`;
    
    try {
        // Increment and set TTL if new key
        const count = await redis.incr(key);
        
        // Set TTL only on first increment
        if (count === 1) {
            await redis.expire(key, WINDOW_TTL);
        }
        
        const remaining = Math.max(0, MAX_ATTEMPTS - count);
        
        logger.debug('CMDHUB', `📊 Rate limit: ${action} → ${count}/${MAX_ATTEMPTS}`);
        
        return { count, remaining };
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao incrementar rate limit', error.message);
        return { count: 0, remaining: MAX_ATTEMPTS };
    }
}

/**
 * Reset rate limit for an action
 * @param {string} action - Action identifier
 * @param {string} identifier - User or system identifier
 */
export async function resetRateLimit(action, identifier = 'system') {
    const key = `${RATE_LIMIT_PREFIX}${action}:${identifier}`;
    
    try {
        await redis.del(key);
        logger.info('CMDHUB', `🔄 Rate limit resetado: ${action}`);
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao resetar rate limit', error.message);
    }
}

/**
 * Get all rate limit stats
 * @returns {Promise<Array>}
 */
export async function getRateLimitStats() {
    try {
        const keys = await redis.keys(`${RATE_LIMIT_PREFIX}*`);
        const stats = [];
        
        for (const key of keys) {
            const count = await redis.get(key);
            const ttl = await redis.ttl(key);
            const action = key.replace(RATE_LIMIT_PREFIX, '');
            
            stats.push({
                action,
                count: parseInt(count, 10),
                remaining: Math.max(0, MAX_ATTEMPTS - parseInt(count, 10)),
                resetIn: ttl,
                blocked: parseInt(count, 10) >= MAX_ATTEMPTS
            });
        }
        
        return stats;
    } catch (error) {
        logger.error('CMDHUB', 'Erro ao obter stats de rate limit', error.message);
        return [];
    }
}

export default {
    checkRateLimit,
    incrementRateLimit,
    resetRateLimit,
    getRateLimitStats,
    MAX_ATTEMPTS,
    WINDOW_TTL
};
