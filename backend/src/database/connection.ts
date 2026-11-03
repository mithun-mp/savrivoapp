import mongoose from 'mongoose';
import { config } from '../config/env';
import { sanitizeMongoUri, sanitizeErrorMessage, sanitizeError } from '../utils/sanitize';

export { sanitizeMongoUri, sanitizeErrorMessage, sanitizeError };

let eventListenersAttached = false;

function attachLifecycleEventListeners(): void {
  if (eventListenersAttached) return;
  eventListenersAttached = true;

  mongoose.connection.on('connected', () => {
    console.log('[DB] MongoDB Atlas connection established');
  });

  mongoose.connection.on('disconnected', () => {
    console.warn('[DB] MongoDB Atlas disconnected. Driver will attempt automatic reconnection.');
  });

  mongoose.connection.on('reconnected', () => {
    console.log('[DB] MongoDB Atlas reconnected successfully');
  });

  mongoose.connection.on('error', (err: unknown) => {
    const sanitized = sanitizeError(err);
    const message = sanitized instanceof Error ? sanitized.message : String(sanitized);
    console.error('[DB] MongoDB Atlas connection error:', message);
  });
}

/**
 * Connects to MongoDB Atlas using Mongoose.
 * Avoids opening redundant connections and fails safely if URI is missing in production.
 */
export async function connectDatabase(): Promise<void> {
  // If already connected, reuse connection
  if (mongoose.connection.readyState === 1) {
    return;
  }

  // If connection is in progress, wait for it
  if (mongoose.connection.readyState === 2) {
    await new Promise<void>((resolve, reject) => {
      mongoose.connection.once('connected', () => resolve());
      mongoose.connection.once('error', (err) => reject(sanitizeError(err)));
    });
    return;
  }

  if (!config.mongoUri) {
    if (config.isProd) {
      throw new Error(
        '[DB] FATAL: MONGODB_URI environment variable is missing in production. ' +
        'Cannot start SAVRIVO backend without a valid MongoDB Atlas connection.'
      );
    }
    console.warn(
      '[DB] WARNING: MONGODB_URI is not set. Database features will be unavailable in development.'
    );
    return;
  }

  attachLifecycleEventListeners();

  const connectOptions: mongoose.ConnectOptions = {
    serverSelectionTimeoutMS: 10000,
    dbName: 'savrivo',
    ...(process.env.MONGODB_TLS_ALLOW_INVALID_CERTS === 'true' || config.isDev
      ? { tlsAllowInvalidCertificates: true }
      : {}),
  };

  try {
    mongoose.set('strictQuery', false);

    console.log(`[DB] Connecting to MongoDB Atlas: ${sanitizeMongoUri(config.mongoUri)}...`);

    await mongoose.connect(config.mongoUri, connectOptions);

    console.log('[DB] Successfully connected to MongoDB Atlas database: savrivo');
  } catch (err: unknown) {
    // If local network DNS rejects SRV records (common on some Windows networks), attempt once with public DNS resolvers
    if (err instanceof Error && err.message.includes('querySrv ECONNREFUSED')) {
      try {
        console.warn('[DB] Local DNS rejected SRV lookup. Retrying with public DNS resolvers (8.8.8.8, 1.1.1.1)...');
        const dns = await import('dns');
        dns.setServers(['8.8.8.8', '1.1.1.1']);
        await mongoose.connect(config.mongoUri, connectOptions);
        console.log('[DB] Successfully connected to MongoDB Atlas database: savrivo');
        return;
      } catch (retryErr: unknown) {
        const sanitizedRetry = sanitizeError(retryErr);
        const retryMsg = sanitizedRetry instanceof Error ? sanitizedRetry.message : String(sanitizedRetry);
        console.error('[DB] Failed to connect to MongoDB Atlas after DNS fallback:', retryMsg);
        throw sanitizedRetry;
      }
    }

    const sanitizedErr = sanitizeError(err);
    const message = sanitizedErr instanceof Error ? sanitizedErr.message : String(sanitizedErr);
    console.error('[DB] Failed to connect to MongoDB Atlas:', message);
    throw sanitizedErr;
  }
}

/**
 * Gracefully closes the MongoDB connection.
 */
export async function disconnectDatabase(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      console.log('[DB] MongoDB connection closed gracefully');
    } catch (err: unknown) {
      const sanitized = sanitizeError(err);
      const message = sanitized instanceof Error ? sanitized.message : String(sanitized);
      console.error('[DB] Error during MongoDB disconnect:', message);
    }
  }
}

/**
 * Returns human-readable database connection status.
 */
export function getDbStatus(): 'connected' | 'connecting' | 'disconnected' | 'disconnecting' {
  const states: Record<number, 'disconnected' | 'connected' | 'connecting' | 'disconnecting'> = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting',
  };
  return states[mongoose.connection.readyState] ?? 'disconnected';
}