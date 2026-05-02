import { createClient } from 'redis';

import { logger } from './corelens';

export const redis = createClient({
  url: process.env.REDIS_URL ?? 'redis://localhost:6379',
});

redis.on('error', (error) => {
  logger.error('Redis error', {
    message: error instanceof Error ? error.message : String(error),
  });
});

export async function connectRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }
}

export async function closeRedis() {
  if (redis.isOpen) {
    await redis.quit();
  }
}
