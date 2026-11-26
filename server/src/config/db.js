import mongoose from 'mongoose';
import { env } from './env.js';

let memoryServer = null;

/**
 * Connect to MongoDB using MONGO_URI, or spin up mongodb-memory-server
 * when USE_MEMORY_DB=true (useful for zero-setup demos and Vitest integration suites).
 */
export async function connectDatabase(customUri) {
  if (mongoose.connection.readyState === 1) {
    return { uri: mongoose.connection.host, isMemory: Boolean(memoryServer) };
  }

  let uri = customUri || env.mongoUri;
  let isMemory = false;

  if (!customUri && env.useMemoryDb) {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    memoryServer = await MongoMemoryServer.create();
    uri = memoryServer.getUri();
    isMemory = true;
  }

  await mongoose.connect(uri);
  return { uri, isMemory };
}

/**
 * Cleanly close Mongoose and stop any embedded MongoMemoryServer instance.
 */
export async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}
