// Redis connection configuration
require('dotenv').config();
const Redis = require('ioredis');

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseInt(process.env.REDIS_DB) || 0,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  },
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
};

// Create Redis client
const redisClient = new Redis(redisConfig);

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
  // Don't exit process, Redis will retry
});

redisClient.on('connect', () => {
  console.log('✅ Redis client connected');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
});

redisClient.on('close', () => {
  console.log('⚠️  Redis client connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis client reconnecting...');
});

// Graceful shutdown
process.on('SIGINT', async () => {
  await redisClient.quit();
  console.log('Redis client closed gracefully');
});

process.on('SIGTERM', async () => {
  await redisClient.quit();
  console.log('Redis client closed gracefully');
});

// Test Redis connection
const testConnection = async () => {
  try {
    const result = await redisClient.ping();
    return { success: result === 'PONG', message: result };
  } catch (error) {
    console.error('Redis connection test failed:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  redisClient,
  testConnection,
};
