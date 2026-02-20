import redis from '../modules/redis/index.js';

const CACHE_KEY = 'hello_world_cache';
const CACHE_TTL = 60; // seconds

async function routes(fastify, options) {
    fastify.get('/', async (req, reply) => {
        try {
            // Try to get from Redis cache
            const cached = await redis.get(CACHE_KEY);
            
            if (cached) {
                console.log('Cache HIT - returning cached data');
                reply.header('X-Cache', 'HIT');
                reply.header('X-Cache-Source', 'Redis');
                return JSON.parse(cached);
            }
            
            // Cache MISS - generate response
            console.log('Cache MISS - generating new response');
            const response = { hello: 'world', timestamp: new Date().toISOString() };
            
            // Store in Redis with TTL
            await redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(response));
            
            reply.header('X-Cache', 'MISS');
            reply.header('X-Cache-Source', 'Redis');
            return response;
        } catch (error) {
            console.error('Redis error:', error.message);
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
}

export default routes;