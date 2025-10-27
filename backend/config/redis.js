const Redis = require('ioredis');
const logger = require('./logger');

const redis = new Redis({
  host: process.env.REDIS_HOST || 'redis',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD,
  db: 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false
});

redis.on('connect', () => {
  logger.info('✅ Redis connected');
});

redis.on('error', (err) => {
  logger.error('❌ Redis error:', err);
});

redis.on('ready', () => {
  logger.info('Redis client ready');
});

// Cache middleware
const cacheMiddleware = (keyPrefix, ttl = 3600) => {
  return async (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const key = `${keyPrefix}:${JSON.stringify(req.query)}`;

    try {
      const cached = await redis.get(key);
      if (cached) {
        logger.debug(`Cache hit: ${key}`);
        return res.json(JSON.parse(cached));
      }
      logger.debug(`Cache miss: ${key}`);
    } catch (error) {
      logger.error('Cache read error:', error);
    }

    // Override res.json to cache the response
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      redis.setex(key, ttl, JSON.stringify(body))
        .catch(err => logger.error('Cache write error:', err));
      return originalJson(body);
    };

    next();
  };
};

// Cache helper functions
async function setCache(key, value, ttl = 3600) {
  try {
    await redis.setex(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('setCache error:', error);
    return false;
  }
}

async function getCache(key) {
  try {
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('getCache error:', error);
    return null;
  }
}

async function deleteCache(key) {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    logger.error('deleteCache error:', error);
    return false;
  }
}

async function invalidatePattern(pattern) {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length > 0) {
      await redis.del(...keys);
      logger.info(`Invalidated ${keys.length} cache keys matching ${pattern}`);
    }
    return true;
  } catch (error) {
    logger.error('invalidatePattern error:', error);
    return false;
  }
}

module.exports = {
  redis,
  cacheMiddleware,
  setCache,
  getCache,
  deleteCache,
  invalidatePattern
};
