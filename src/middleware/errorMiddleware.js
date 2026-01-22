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
    const errorMessage = reason instanceof Error ? reason.message : String(reason);
    const errorStack = reason instanceof Error ? reason.stack : undefined;
    
    console.error('❌ Unhandled Promise Rejection:', errorMessage);
    if (errorStack) {
      console.error('Stack:', errorStack.split('\n').slice(0, 10).join('\n'));
    }
    
    if (logger && logger.error) {
      logger.error('Unhandled Rejection', {
        reason: errorMessage,
        stack: errorStack,
        promise: promise?.toString(),
      });
    }
    
    try {
      captureException(reason instanceof Error ? reason : new Error(String(reason)), {
        type: 'unhandledRejection',
      });
    } catch (captureError) {
      console.error('Failed to capture exception:', captureError.message);
    }
  });
};

/**
 * Handle uncaught exceptions
 */
const setupUncaughtExceptionHandler = () => {
  process.on('uncaughtException', (error) => {
    console.error('❌ Uncaught Exception:', error.message);
    if (error.stack) {
      console.error('Stack:', error.stack.split('\n').slice(0, 10).join('\n'));
    }
    
    if (logger && logger.error) {
      logger.error('Uncaught Exception', {
        message: error.message,
        stack: error.stack,
      });
    }
    
    try {
      captureException(error, {
        type: 'uncaughtException',
      });
    } catch (captureError) {
      console.error('Failed to capture exception:', captureError.message);
    }
    
    // Wait for Sentry to flush before exiting
    (async () => {
      try {
        const { Sentry } = require('../utils/errorHandler');
        if (process.env.SENTRY_DSN) {
          await Sentry.flush(2000); // Wait up to 2 seconds for Sentry to send
        }
      } catch (flushError) {
        if (logger && logger.error) {
          logger.error('Error flushing Sentry', { error: flushError.message });
        } else {
          console.error('Error flushing Sentry:', flushError.message);
        }
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
