import Redis from 'ioredis';
import { config } from './env.js';

let redisClient = null;

export function getRedisConnection() {
  if (redisClient) return redisClient;

  const redisUrl = process.env.REDIS_URL;

  if (redisUrl) {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      enableReadyCheck: true,
      lazyConnect: true,
    });
  } else {
    redisClient = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => Math.min(times * 200, 2000),
      enableReadyCheck: true,
      lazyConnect: true,
    });
  }

  redisClient.on('error', (err) => {
    console.error('Redis connection error:', err.message);
  });

  redisClient.on('connect', () => {
    console.log('Redis connected');
  });

  return redisClient;
}

export async function closeRedisConnection() {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}