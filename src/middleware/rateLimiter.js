// Rate limiting middleware configuration
const rateLimit = require('express-rate-limit');
const { ipKeyGenerator } = require('express-rate-limit');
const { redisClient } = require('../config/redis');

// Determine environment
const isDevelopment = process.env.NODE_ENV === 'development' || !process.env.NODE_ENV;
const isProduction = process.env.NODE_ENV === 'production';

// Custom Redis store adapter for express-rate-limit using ioredis
class RedisStore {
  constructor(client) {
    this.client = client;
    this.prefix = 'ratelimit:';
  }

  async increment(key) {
    const redisKey = `${this.prefix}${key}`;
    const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000;
    
    try {
      // Use Redis pipeline for atomic operations
      const pipeline = this.client.pipeline();
      pipeline.incr(redisKey);
      pipeline.pttl(redisKey); // Get remaining TTL
      const results = await pipeline.exec();
      
      if (results && results[0] && results[0][1] !== null) {
        const totalHits = results[0][1];
        const ttl = results[1] && results[1][1] ? results[1][1] : windowMs;
        
        // Set expiry if key is new (TTL is -1) or doesn't exist (TTL is -2)
        if (ttl === -1 || ttl === -2) {
          await this.client.pexpire(redisKey, windowMs);
        }
        
        const resetTime = new Date(Date.now() + (ttl > 0 ? ttl : windowMs));
        return { totalHits, resetTime };
      }
      // Fallback if pipeline fails
      const totalHits = await this.client.incr(redisKey);
      await this.client.pexpire(redisKey, windowMs);
      return { totalHits, resetTime: new Date(Date.now() + windowMs) };
    } catch (error) {
      console.error('Redis store error:', error.message);
      // Fallback to in-memory behavior
      return { totalHits: 1, resetTime: new Date(Date.now() + windowMs) };
    }
  }

  async decrement(key) {
    const redisKey = `${this.prefix}${key}`;
    try {
      await this.client.decr(redisKey);
    } catch (error) {
      console.error('Redis store decrement error:', error.message);
    }
  }

  async resetKey(key) {
    const redisKey = `${this.prefix}${key}`;
    try {
      await this.client.del(redisKey);
    } catch (error) {
      console.error('Redis store reset error:', error.message);
    }
  }

  async shutdown() {
    // Redis client is managed separately, no need to close here
  }
}

// Get store based on environment and Redis availability
const getStore = () => {
  // Try to use Redis if available (works in both dev and prod)
  if (redisClient) {
    try {
      // Check if Redis is ready or connecting
      const status = redisClient.status;
      if (status === 'ready' || status === 'connect') {
        return new RedisStore(redisClient);
      }
    } catch (error) {
      console.warn('Redis not ready, falling back to in-memory store:', error.message);
    }
  }
  // Fallback to in-memory store if Redis is unavailable
  return undefined; // Use default in-memory store
};

// Environment-aware rate limits
const getGeneralLimit = () => {
  if (process.env.RATE_LIMIT_MAX) {
    return parseInt(process.env.RATE_LIMIT_MAX);
  }
  return isDevelopment ? 1000 : 200; // Dev: 1000, Prod: 200
};

const getUserLimit = () => {
  if (process.env.USER_RATE_LIMIT_MAX) {
    return parseInt(process.env.USER_RATE_LIMIT_MAX);
  }
  return isDevelopment ? 500 : 300; // Dev: 500, Prod: 300
};

const getAuthLimit = () => {
  if (process.env.AUTH_RATE_LIMIT_MAX) {
    return parseInt(process.env.AUTH_RATE_LIMIT_MAX);
  }
  return isDevelopment ? 15 : 5; // Dev: 15 attempts, Prod: 5 (brute-force protection)
};

const getWriteLimit = () => {
  if (process.env.WRITE_RATE_LIMIT_MAX) {
    return parseInt(process.env.WRITE_RATE_LIMIT_MAX);
  }
  return isDevelopment ? 100 : 50; // Dev: 100, Prod: 50
};

const windowMs = parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000; // 15 minutes

// General API rate limiter (for unauthenticated routes only)
// This applies to routes that don't require authentication
const generalLimiter = rateLimit({
  store: getStore(),
  windowMs: windowMs,
  max: getGeneralLimit(),
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/api/status/health' || req.path === '/api/status/redis') {
      return true;
    }
    // Skip authenticated routes - they use userLimiter instead
    // Only apply to unauthenticated routes like auth and status
    const authenticatedRoutePatterns = [
      '/api/users',
      '/api/posts',
      '/api/comments',
      '/api/experiences',
      '/api/education',
      '/api/skills',
      '/api/certifications',
      '/api/publications',
      '/api/projects',
      '/api/awards',
      '/api/organizations',
      '/api/upload',
      '/api/search',
      '/api/v1/users',
      '/api/v1/posts',
      '/api/v1/comments',
      '/api/v1/upload',
      '/api/v1/search',
    ];
    
    // Skip if this is an authenticated route (will be handled by userLimiter)
    const isAuthenticatedRoute = authenticatedRoutePatterns.some(pattern => 
      req.path.startsWith(pattern)
    );
    
    return isAuthenticatedRoute;
  },
});

// Strict rate limiter for authentication endpoints (limits failed attempts per IP)
const authLimiter = rateLimit({
  store: getStore(),
  windowMs: windowMs,
  max: getAuthLimit(),
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Only count failed attempts; successful login does not consume limit
});

// Strict rate limiter for write operations (POST, PUT, DELETE)
const writeLimiter = rateLimit({
  store: getStore(),
  windowMs: windowMs,
  max: getWriteLimit(),
  message: {
    success: false,
    message: 'Too many write requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// User-specific rate limiter (for authenticated routes)
// Uses user ID if authenticated, falls back to IP if not
// This allows it to work even when applied before authentication middleware
// Note: When applied at router level, it runs before route handlers
// Routes that require auth will have authenticateToken which sets req.user
// But since this runs before route handlers, we use IP as fallback
// The keyGenerator will use user ID if available (set by later middleware), otherwise IP
const userLimiter = rateLimit({
  store: getStore(),
  windowMs: windowMs,
  max: getUserLimit(),
  keyGenerator: (req, res) => {
    // Use user ID if authenticated (set by authenticateToken middleware in route handlers)
    // Note: When applied at router level, this runs before route handlers
    // So req.user might not be set yet, but that's OK - we'll use IP as fallback
    // If the route has authenticateToken, it will set req.user, but by then this has already run
    // So we need to apply userLimiter AFTER authenticateToken in route handlers
    // For now, use IP as fallback
    if (req.user && req.user.id) {
      return `user:${req.user.id}`;
    }
    // Fallback: use IP address with proper IPv6 handling
    // Extract IP from request (handles proxy headers)
    const ip = req.ip || 
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() || 
               req.connection?.remoteAddress || 
               req.socket?.remoteAddress ||
               'unknown';
    // Use ipKeyGenerator helper to properly normalize IPv6 addresses
    // This prevents IPv6 users from bypassing rate limits
    const ipKey = ipKeyGenerator(ip);
    return `ip:${ipKey}`;
  },
  message: {
    success: false,
    message: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health checks
    if (req.path === '/api/status/health' || req.path === '/api/status/redis') {
      return true;
    }
    // Don't skip - always apply rate limiting
    // Use user ID if available, IP if not
    return false;
  },
});

// Middleware wrapper to apply userLimiter only to authenticated routes
// This should be applied after authentication middleware
// Note: This middleware should be applied at the route level AFTER authenticateToken
const applyUserLimiter = (req, res, next) => {
  // If user is authenticated, apply userLimiter
  // Otherwise, skip (let generalLimiter handle it)
  if (req.user && req.user.id) {
    return userLimiter(req, res, next);
  }
  // If not authenticated, skip this limiter (generalLimiter will handle it)
  next();
};


module.exports = {
  generalLimiter,
  authLimiter,
  writeLimiter,
  userLimiter,
  applyUserLimiter,
};
