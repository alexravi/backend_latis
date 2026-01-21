// Winston logger configuration for structured logging
const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path = require('path');

// Define log format (for file logs - always JSON)
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json()
);

// Beautiful console format for human readability
const createBeautifulConsoleFormat = () => {
  // Color helper
  const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
  };

  return winston.format.printf(({ timestamp, level, message, ...metadata }) => {
    // Parse timestamp to readable format
    const time = new Date(timestamp).toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Level icons and colors
    const levelConfig = {
      error: { icon: '❌', color: colors.red, label: 'ERROR' },
      warn: { icon: '⚠️ ', color: colors.yellow, label: 'WARN' },
      info: { icon: 'ℹ️ ', color: colors.cyan, label: 'INFO' },
      debug: { icon: '🔍', color: colors.blue, label: 'DEBUG' },
      verbose: { icon: '📝', color: colors.dim, label: 'VERBOSE' },
    };

    const config = levelConfig[level] || { icon: '•', color: colors.white, label: level.toUpperCase() };
    
    // Special formatting for HTTP requests
    if (message === 'HTTP Request' && metadata.method && metadata.url) {
      const statusCode = metadata.statusCode;
      const methodColors = {
        GET: colors.cyan,
        POST: colors.green,
        PUT: colors.yellow,
        PATCH: colors.yellow,
        DELETE: colors.red,
      };
      const methodColor = methodColors[metadata.method] || colors.white;
      
      // Status code colors
      let statusColor = colors.green;
      if (statusCode >= 500) statusColor = colors.red;
      else if (statusCode >= 400) statusColor = colors.yellow;
      else if (statusCode >= 300) statusColor = colors.cyan;

      // Format URL (truncate if too long)
      let url = metadata.url;
      if (url.length > 60) {
        url = url.substring(0, 57) + '...';
      }

      // Build formatted log line
      let logLine = `${colors.dim}${time}${colors.reset} `;
      logLine += `${methodColor}${metadata.method.padEnd(6)}${colors.reset} `;
      logLine += `${statusColor}${statusCode}${colors.reset} `;
      logLine += `${colors.white}${url.padEnd(63)}${colors.reset} `;
      logLine += `${colors.dim}${metadata.responseTime || ''}${colors.reset}`;
      
      if (metadata.userId) {
        logLine += ` ${colors.magenta}[User: ${metadata.userId}]${colors.reset}`;
      }

      return logLine;
    }

    // Special formatting for errors
    if (level === 'error') {
      let logLine = `${colors.dim}${time}${colors.reset} `;
      logLine += `${config.color}${config.icon} ${config.label}${colors.reset} `;
      
      // Show actual error message if available in metadata
      const errorMessage = metadata.message || message;
      logLine += `${colors.bright}${errorMessage}${colors.reset}`;
      
      // Add request context if available
      if (metadata.request) {
        const req = metadata.request;
        logLine += ` ${colors.dim}(${req.method} ${req.url})${colors.reset}`;
      }
      
      // Add stack trace if available
      if (metadata.stack) {
        logLine += `\n${colors.dim}${metadata.stack}${colors.reset}`;
      }
      
      return logLine;
    }

    // Default formatting for other logs
    let logLine = `${colors.dim}${time}${colors.reset} `;
    logLine += `${config.color}${config.icon} ${config.label}${colors.reset} `;
    logLine += `${colors.white}${message}${colors.reset}`;

    // Add metadata in a readable way
    if (Object.keys(metadata).length > 0) {
      // Filter out internal winston properties
      const cleanMetadata = { ...metadata };
      delete cleanMetadata.service;
      delete cleanMetadata.environment;
      
      if (Object.keys(cleanMetadata).length > 0) {
        // Format metadata nicely
        const metaStr = Object.entries(cleanMetadata)
          .map(([key, value]) => {
            // Truncate long values
            let val = typeof value === 'object' ? JSON.stringify(value) : String(value);
            if (val.length > 100) val = val.substring(0, 97) + '...';
            return `${colors.dim}${key}${colors.reset}${colors.white}=${colors.reset}${colors.cyan}${val}${colors.reset}`;
          })
          .join(` ${colors.dim}│${colors.reset} `);
        logLine += ` ${colors.dim}(${metaStr})${colors.reset}`;
      }
    }

    return logLine;
  });
};

// Console format with colors and beautiful formatting
const consoleFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  createBeautifulConsoleFormat()
);

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
const fs = require('fs');

// Ensure logs directory exists before configuring file transports
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Define transports
const transports = [];

// Console transport (always enabled) - use beautiful format for console output
// JSON format is only used for file logs
transports.push(
  new winston.transports.Console({
    format: consoleFormat, // Always use beautiful format for console
    level: process.env.LOG_LEVEL || 'info',
  })
);

// File transports (only in production or if LOG_TO_FILE is enabled)
if (process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true') {
  // Error log file
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'error-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d', // Keep 14 days of logs
      zippedArchive: true,
    })
  );

  // Combined log file (all levels)
  transports.push(
    new DailyRotateFile({
      filename: path.join(logsDir, 'combined-%DATE%.log'),
      datePattern: 'YYYY-MM-DD',
      format: logFormat,
      maxSize: '20m',
      maxFiles: '14d', // Keep 14 days of logs
      zippedArchive: true,
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),
  format: logFormat,
  defaultMeta: {
    service: 'backend-latis',
    environment: process.env.NODE_ENV || 'development',
  },
  transports,
  // Handle exceptions and rejections
  exceptionHandlers: process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true'
    ? [
        new DailyRotateFile({
          filename: path.join(logsDir, 'exceptions-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      ]
    : [new winston.transports.Console({ format: consoleFormat })],
  rejectionHandlers: process.env.NODE_ENV === 'production' || process.env.LOG_TO_FILE === 'true'
    ? [
        new DailyRotateFile({
          filename: path.join(logsDir, 'rejections-%DATE%.log'),
          datePattern: 'YYYY-MM-DD',
          format: logFormat,
          maxSize: '20m',
          maxFiles: '14d',
          zippedArchive: true,
        }),
      ]
    : [new winston.transports.Console({ format: consoleFormat })],
});

// Helper methods for common logging patterns
logger.logRequest = (req, res, responseTime) => {
  const logData = {
    method: req.method,
    url: req.originalUrl || req.url,
    statusCode: res.statusCode,
    responseTime: `${responseTime}ms`,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  if (req.user) {
    logData.userId = req.user.id;
  }

  // Log as info for successful requests, warn for client errors, error for server errors
  if (res.statusCode >= 500) {
    logger.error('HTTP Request', logData);
  } else if (res.statusCode >= 400) {
    logger.warn('HTTP Request', logData);
  } else {
    logger.info('HTTP Request', logData);
  }
};

logger.logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context,
  });
};

logger.logDatabaseQuery = (query, duration, params = null) => {
  if (process.env.LOG_LEVEL === 'debug' || process.env.NODE_ENV !== 'production') {
    logger.debug('Database Query', {
      query: query.substring(0, 200), // Truncate long queries
      duration: `${duration}ms`,
      params: params ? JSON.stringify(params).substring(0, 200) : null,
    });
  }
};

module.exports = logger;
