import mongoose from 'mongoose';

// Connection state
let isConnected = false;

/**
 * MongoDB connection options
 */
const defaultOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

/**
 * Connect to MongoDB
 * @param {string} uri - MongoDB connection URI (defaults to MONGO_URI env)
 * @param {object} options - Mongoose connection options
 * @returns {Promise<typeof mongoose>}
 */
export async function connect(uri = process.env.MONGO_URI, options = {}) {
    if (isConnected) {
        console.log('MongoDB already connected');
        return mongoose;
    }

    if (!uri) {
        throw new Error('MongoDB URI is required. Set MONGO_URI in .env or pass as argument.');
    }

    try {
        const opts = { ...defaultOptions, ...options };
        await mongoose.connect(uri, opts);
        
        isConnected = true;
        console.log('MongoDB connected successfully');
        
        // Connection events
        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err.message);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected');
            isConnected = false;
        });

        return mongoose;
    } catch (error) {
        console.error('MongoDB connection failed:', error.message);
        throw error;
    }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnect() {
    if (!isConnected) {
        return;
    }
    
    await mongoose.disconnect();
    isConnected = false;
    console.log('MongoDB disconnected');
}

/**
 * Check if connected to MongoDB
 * @returns {boolean}
 */
export function isConnectedToMongo() {
    return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Get the mongoose instance (for advanced usage)
 */
export { mongoose };

/**
 * Get the mongoose Schema class for creating models
 */
export const Schema = mongoose.Schema;

/**
 * Get the mongoose Types (ObjectId, etc)
 */
export const Types = mongoose.Types;

export default {
    connect,
    disconnect,
    isConnected: isConnectedToMongo,
    mongoose,
    Schema,
    Types
};
