import Redis from 'ioredis';
import logger from '../../app/modules/nexus/utils/logger.js';

// Decode CA certificate from Base64 environment variable
const caCert = Buffer.from(process.env.REDIS_CA_CERT, 'base64');

const redis = new Redis(process.env.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: true,
    tls: {
        ca: caCert,
        rejectUnauthorized: true
    }
});

redis.on('error', (err) => {
    logger.redis.error(err);
});

redis.on('connect', () => {
    logger.redis.connected();
});

export default redis;
