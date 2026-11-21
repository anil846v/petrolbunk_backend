const Redis = require('ioredis');
const logger = require('../utils/logger');

const redisEnabled = process.env.REDIS_ENABLED !== 'false';
const redisUrl = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

let redisClient = null;
let isConnected = false;

if (redisEnabled) {
  try {
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 1, // Don't hold up HTTP requests if Redis is unreachable
      connectTimeout: 2000,
      lazyConnect: true,      // Non-blocking connection on startup
      retryStrategy(times) {
        if (times > 10) {
          logger.warn('Redis retry limit reached. In-memory caching offline.');
          return null; // Stop retrying after 10 attempts
        }
        return Math.min(times * 200, 3000);
      },
    });

    redisClient.on('connect', () => {
      isConnected = true;
      logger.info('⚡ Redis In-Memory Cache connected successfully');
    });

    redisClient.on('ready', () => {
      isConnected = true;
    });

    redisClient.on('close', () => {
      isConnected = false;
    });

    redisClient.on('error', (err) => {
      isConnected = false;
      if (process.env.NODE_ENV === 'development') {
        logger.debug(`[Redis] Offline or unreachable (${err.message}) - Falling back to MySQL directly`);
      } else {
        logger.warn(`[Redis] Connection warning: ${err.message}`);
      }
    });

    // Initiate non-blocking connection
    redisClient.connect().catch(() => {});
  } catch (err) {
    logger.warn('[Redis] Initialization error:', err.message);
  }
}

/**
 * Retrieve cached JSON value by key.
 * Returns null if Redis is offline or key does not exist.
 */
const getCache = async (key) => {
  if (!isConnected || !redisClient) return null;
  try {
    const raw = await redisClient.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    logger.debug(`[Redis] GET failed for [${key}]: ${err.message}`);
    return null;
  }
};

/**
 * Store value as JSON string with TTL in seconds.
 */
const setCache = async (key, value, ttlSeconds = 300) => {
  if (!isConnected || !redisClient) return false;
  try {
    const serialized = JSON.stringify(value);
    await redisClient.set(key, serialized, 'EX', ttlSeconds);
    return true;
  } catch (err) {
    logger.debug(`[Redis] SET failed for [${key}]: ${err.message}`);
    return false;
  }
};

/**
 * Delete one or more keys (Cache Invalidation / Busting).
 * Supports exact key ("petrolbunk:summary") or wildcards ("petrolbunk:*").
 */
const delCache = async (patternOrKey) => {
  if (!isConnected || !redisClient) return false;
  try {
    if (patternOrKey.includes('*')) {
      const keys = await redisClient.keys(patternOrKey);
      if (keys.length > 0) {
        await redisClient.del(...keys);
      }
    } else {
      await redisClient.del(patternOrKey);
    }
    return true;
  } catch (err) {
    logger.debug(`[Redis] DEL failed for [${patternOrKey}]: ${err.message}`);
    return false;
  }
};

/**
 * Enterprise Cache-Aside helper:
 * 1. Checks Redis cache.
 * 2. On miss, executes fetchFn() database query.
 * 3. Saves fresh result into Redis with TTL.
 */
const getOrSetCache = async (key, ttlSeconds, fetchFn) => {
  const cached = await getCache(key);
  if (cached !== null) {
    return cached;
  }

  const fresh = await fetchFn();
  if (fresh !== undefined && fresh !== null) {
    // Non-blocking cache store
    setCache(key, fresh, ttlSeconds).catch(() => {});
  }
  return fresh;
};

module.exports = {
  redisClient,
  isRedisConnected: () => isConnected,
  getCache,
  setCache,
  delCache,
  getOrSetCache,
};
