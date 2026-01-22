// Redis connection configuration
require('dotenv').config();
const Redis = require('ioredis');

/**
 * Parse Redis connection string into config object
 * Supports formats:
 * - redis://username:password@host:port
 * - rediss://username:password@host:port (SSL)
 * - redis://host:port
 * - host:port,password=...,ssl=true (Azure format)
 */
const parseConnectionString = (connectionString) => {
  if (!connectionString) return null;

  // Azure Cache for Redis format: host:port,password=...,ssl=True,abortConnect=False
  if (connectionString.includes(',') && connectionString.includes('password=')) {
    const parts = connectionString.split(',');
    const [host, port] = parts[0].split(':');
    const hostname = host.trim();
    const portNum = parseInt(port) || 6379;
    const config = {
      host: hostname,
      port: portNum,
    };

    let hasSsl = false;
    parts.slice(1).forEach(part => {
      const [key, value] = part.split('=').map(s => s.trim());
      const lowerValue = value.toLowerCase();
      if (key === 'password') {
        config.password = value;
      } else if (key === 'ssl' && (lowerValue === 'true' || lowerValue === '1')) {
        hasSsl = true;
      }
      // Ignore abortConnect and other Azure-specific options
    });

    // Azure Cache for Redis requires TLS configuration with servername
    if (hasSsl) {
      config.tls = {
        servername: hostname, // Required for Azure Cache for Redis SSL
        // Azure uses self-signed certificates, so we may need to check server identity
        checkServerIdentity: () => undefined, // Skip hostname verification for Azure
      };
      // Add connection timeout for Azure
      config.connectTimeout = 10000; // 10 seconds
      config.commandTimeout = 5000; // 5 seconds
    }

    return config;
  }

  // Standard Redis URL format: redis://username:password@host:port
  try {
    const url = new URL(connectionString);
    const config = {
      host: url.hostname,
      port: parseInt(url.port) || 6379,
    };

    if (url.password) {
      config.password = url.password;
    }

    if (url.username) {
      config.username = url.username;
    }

    // Handle SSL/TLS
    if (url.protocol === 'rediss:') {
      config.tls = {};
    }

    return config;
  } catch (error) {
    console.error('Failed to parse Redis connection string:', error.message);
    return null;
  }
};

/**
 * Get Redis connection configuration
 * Supports both connection string and individual environment variables
 */
const getRedisConnectionConfig = () => {
  // Priority 1: Use connection string if provided
  if (process.env.REDIS_CONNECTION_STRING) {
    const parsed = parseConnectionString(process.env.REDIS_CONNECTION_STRING);
    if (parsed) {
      return {
        ...parsed,
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
      };
    }
  }

  // Priority 2: Use individual environment variables
  return {
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
};

// Redis client configuration
const redisConfig = getRedisConnectionConfig();

// Log connection details (without sensitive info)
if (process.env.REDIS_CONNECTION_STRING) {
  const connectionString = process.env.REDIS_CONNECTION_STRING;
  const isUrlFormat = connectionString.startsWith('redis://') || connectionString.startsWith('rediss://');
  if (isUrlFormat) {
    try {
      const url = new URL(connectionString);
      console.log(`🔌 Connecting to Redis via URL: ${url.protocol}//${url.hostname}:${url.port || 'default'}`);
    } catch (e) {
      // Ignore
    }
  } else {
    // Azure format
    const parts = connectionString.split(',');
    const [host, port] = parts[0].split(':');
    console.log(`🔌 Connecting to Azure Redis Cache: ${host.trim()}:${port || 'default'}`);
    if (connectionString.includes('ssl=True')) {
      console.log('   Using SSL/TLS encryption');
    }
  }
}

// Create Redis client
// Check if connection string is a valid URL format (redis:// or rediss://)
// If not, it's Azure format and we use the parsed config
const connectionString = process.env.REDIS_CONNECTION_STRING;
const isUrlFormat = connectionString && (connectionString.startsWith('redis://') || connectionString.startsWith('rediss://'));

const redisClient = connectionString && isUrlFormat
  ? new Redis(connectionString, {
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: false,
    })
  : new Redis(redisConfig);

// Error handling
redisClient.on('error', (err) => {
  console.error('Redis Client Error:', err.message);
  if (err.code === 'ETIMEDOUT' || err.code === 'ECONNREFUSED') {
    console.error('Redis connection timeout/refused. Check:');
    console.error('  - Firewall rules (Azure Cache for Redis allows your IP)');
    console.error('  - Connection string format');
    console.error('  - Network connectivity');
  }
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
  getRedisConnectionConfig,
};
