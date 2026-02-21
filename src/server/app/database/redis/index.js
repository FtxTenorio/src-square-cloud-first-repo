import Redis from 'ioredis';

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
    console.error('Redis connection error:', err.message);
});

redis.on('connect', () => {
    console.log('Redis connected successfully');
});

export default redis;
