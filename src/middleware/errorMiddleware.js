// Error handling middleware
const { captureException } = require('../utils/errorHandler');
const logger = require('../utils/logger');

/**
 * Global error handler middleware
 * Should be the last middleware in the chain
 */
const errorHandler = (err, req, res, next) => {
  // Log error with context
  const errorContext = {
    method: req.method,
    url: req.originalUrl || req.url,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
  };

  if (req.user) {
    errorContext.userId = req.user.id;
  }

  // Capture exception in Sentry
  captureException(err, {
    request: errorContext,
  });

  // Determine status code
  let statusCode = err.statusCode || err.status || 500;
  let message = err.message || 'Internal server error';

  // Don't expose internal errors in production
  if (process.env.NODE_ENV === 'production' && statusCode === 500) {
    message = 'Internal server error';
  }

  // Send error response
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
};

/**
 * 404 Not Found handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  error.statusCode = 404;
  next(error);
};

/**
 * Handle unhandled promise rejections
 */
const setupUnhandledRejectionHandler = () => {
  process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
      reason: reason?.message || reason,
      stack: reason?.stack,
      promise: promise.toString(),
    });
    captureException(reason, {
      type: 'unhandledRejection',
    });
  });
};

/**
 * Handle uncaught exceptions
 */
const setupUncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception', {
      message: error.message,
      stack: error.stack,
    });
    captureException(error, {
      type: 'uncaughtException',
    });
    // Wait for Sentry to flush before exiting
    (async () => {
      try {
        const { Sentry } = require('../utils/errorHandler');
        if (process.env.SENTRY_DSN) {
          await Sentry.flush(2000); // Wait up to 2 seconds for Sentry to send
        }
      } catch (flushError) {
        logger.error('Error flushing Sentry', { error: flushError.message });
      }
      // Exit process after logging (uncaught exceptions are fatal)
      process.exit(1);
    })();
  });
};

module.exports = {
  errorHandler,
  notFoundHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler,
};
