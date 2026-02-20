import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Connection state
let isConnected = false;
let tempCaFile = null;
let tempCertFile = null;

/**
 * Build TLS options from certificates in env (Base64)
 * Supports mTLS (mutual TLS) with CA cert + client cert
 */
function getTlsOptions() {
    const caCert = process.env.MONGO_CA_CERT;
    const clientCert = process.env.MONGO_CLIENT_CERT;
    
    if (!caCert) {
        return {};
    }
    
    try {
        // MongoDB driver needs file paths for TLS files
        // Create temporary files with the certificates
        const caBuffer = Buffer.from(caCert, 'base64');
        tempCaFile = path.join(os.tmpdir(), `mongo-ca-${Date.now()}.crt`);
        fs.writeFileSync(tempCaFile, caBuffer);
        
        const tlsOptions = {
            tls: true,
            tlsCAFile: tempCaFile,
            tlsAllowInvalidCertificates: true,
            tlsAllowInvalidHostnames: true
        };
        
        // If client certificate is provided (mTLS)
        if (clientCert) {
            const certBuffer = Buffer.from(clientCert, 'base64');
            tempCertFile = path.join(os.tmpdir(), `mongo-client-${Date.now()}.pem`);
            fs.writeFileSync(tempCertFile, certBuffer);
            tlsOptions.tlsCertificateKeyFile = tempCertFile;
            console.log('MongoDB CA + Client certificates loaded (mTLS)');
        } else {
            console.log('MongoDB CA certificate loaded');
        }
        
        return tlsOptions;
    } catch (error) {
        console.error('Error setting up TLS:', error.message);
        return {};
    }
}

/**
 * Cleanup temp certificate files
 */
function cleanupTempFiles() {
    if (tempCaFile && fs.existsSync(tempCaFile)) {
        try {
            fs.unlinkSync(tempCaFile);
            tempCaFile = null;
        } catch (e) {
            // ignore
        }
    }
    if (tempCertFile && fs.existsSync(tempCertFile)) {
        try {
            fs.unlinkSync(tempCertFile);
            tempCertFile = null;
        } catch (e) {
            // ignore
        }
    }
}

/**
 * MongoDB connection options
 */
const defaultOptions = {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 10000,
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
        const tlsOptions = getTlsOptions();
        const opts = { ...defaultOptions, ...tlsOptions, ...options };
        
        await mongoose.connect(uri, opts);
        
        isConnected = true;
        console.log('MongoDB connected successfully' + (tlsOptions.tls ? ' (TLS enabled)' : ''));
        
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
        cleanupTempFiles();
        return;
    }
    
    await mongoose.disconnect();
    isConnected = false;
    cleanupTempFiles();
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
