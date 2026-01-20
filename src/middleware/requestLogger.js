// Request/Response logging middleware
const logger = require('../utils/logger');

/**
 * Middleware to log HTTP requests and responses
 * Logs request method, URL, status code, response time, IP, and user agent
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request start (optional, for debugging)
  if (process.env.LOG_LEVEL === 'debug') {
    logger.debug('Incoming Request', {
      method: req.method,
      url: req.originalUrl || req.url,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent'),
    });
  }

  // Override res.end to capture response time
  const originalEnd = res.end;
  res.end = function (...args) {
    res.end = originalEnd;
    const result = originalEnd.apply(this, args);

    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
    
    return result;
  };

  next();
};

module.exports = requestLogger;
