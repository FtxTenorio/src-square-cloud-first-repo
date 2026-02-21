import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import os from 'os';
import logger from '../nexus/utils/logger.js';

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
            logger.debug('MONGO', 'Certificados CA + Cliente carregados (mTLS)');
        } else {
            logger.debug('MONGO', 'Certificado CA carregado');
        }
        
        return tlsOptions;
    } catch (error) {
        logger.error('MONGO', 'Erro ao configurar TLS', error.message);
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
        logger.debug('MONGO', 'Já conectado ao MongoDB');
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
        logger.success('MONGO', `Conectado com sucesso${tlsOptions.tls ? ' (TLS habilitado)' : ''}`);
        
        // Connection events
        mongoose.connection.on('error', (err) => {
            logger.error('MONGO', 'Erro na conexão', err.message);
            isConnected = false;
        });

        mongoose.connection.on('disconnected', () => {
            logger.db.disconnected();
            isConnected = false;
        });

        return mongoose;
    } catch (error) {
        logger.error('MONGO', 'Falha na conexão', error.message);
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
    logger.info('MONGO', 'Desconectado do MongoDB');
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
