import redis from '../../database/redis/index.js';
import cmdhub from '../modules/cmdhub/index.js';
import eventsRoutes from '../modules/events/routes/index.js';
import logger from '../modules/nexus/utils/logger.js';

const CACHE_KEY = 'hello_world_cache';
const CACHE_TTL = 60; // seconds

async function routes(fastify, options) {
    // ═══════════════════════════════════════════════════════════
    // HEALTH CHECK / ROOT
    // ═══════════════════════════════════════════════════════════
    fastify.get('/', async (req, reply) => {
        try {
            // Try to get from Redis cache
            const cached = await redis.get(CACHE_KEY);
            
            if (cached) {
                logger.debug('HTTP', 'Cache HIT - returning cached data');
                reply.header('X-Cache', 'HIT');
                reply.header('X-Cache-Source', 'Redis');
                return JSON.parse(cached);
            }
            
            // Cache MISS - generate response
            logger.debug('HTTP', 'Cache MISS - generating new response');
            const response = { hello: 'world', timestamp: new Date().toISOString() };
            
            // Store in Redis with TTL
            await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(response));
            
            reply.header('X-Cache', 'MISS');
            reply.header('X-Cache-Source', 'Redis');
            return response;
        } catch (error) {
            logger.error('REDIS', 'Erro ao usar cache na rota /', error.message);
            // Fallback if Redis fails
            reply.header('X-Cache', 'ERROR');
            return { hello: 'world', timestamp: new Date().toISOString() };
        }
    })
    
    fastify.post('/', async (req, res) => {
        if(req.body?.name) {
            return {response: req.body.name}
        } else {
            return {error: 'No Valid Body Was Sent!'}
        }
    })
    
    // ═══════════════════════════════════════════════════════════
    // CMDHUB - Command Management API
    // ═══════════════════════════════════════════════════════════
    cmdhub.registerRoutes(fastify);

    // ═══════════════════════════════════════════════════════════
    // EVENTS - Life-Sync (rotina trigger webhook)
    // ═══════════════════════════════════════════════════════════
    fastify.register(eventsRoutes);
}

export default routes;