import Redis from 'ioredis';
import { config } from '../config';

export let redis: Redis | null = null;

export const connectRedis = async (): Promise<boolean> => {
  const client = new Redis(config.redis.url, {
    maxRetriesPerRequest: null,
    lazyConnect: true,
    connectTimeout: 3000,
    retryStrategy: () => null, // disable auto-retry — we handle it once
    enableOfflineQueue: false,
  });

  // Suppress the unhandled 'error' event that ioredis emits before connect() rejects
  client.on('error', () => {});

  try {
    await client.connect();
    redis = client;
    console.log('[redis] Connected');
    return true;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[redis] Not available — CRM queue disabled. (${message})`);
    client.disconnect();
    return false;
  }
};
