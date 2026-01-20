// Error handling utilities with Sentry integration
const Sentry = require('@sentry/node');
const logger = require('./logger');

// Initialize Sentry (only if DSN is provided)
const initializeSentry = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1, // 10% of transactions
      integrations: [
        // Enable HTTP instrumentation
        new Sentry.Integrations.Http({ tracing: true }),
        // Express integration will be added after app is created
      ],
      // Filter out health check endpoints from tracking
      beforeSend(event, hint) {
        // Don't send events for health checks
        if (event.request?.url?.includes('/api/status/health')) {
          return null;
        }
        return event;
      },
    });
    logger.info('Sentry initialized successfully');
  } else {
    logger.info('Sentry DSN not provided, error tracking disabled');
  }
};

// Capture exception
const captureException = (error, context = {}) => {
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      // Add context
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
      Sentry.captureException(error);
    });
  }
  // Always log to our logger
  logger.logError(error, context);
};

// Capture message
const captureMessage = (message, level = 'info', context = {}) => {
  // Validate logger level and map common aliases
  const validLevels = ['error', 'warn', 'info', 'debug', 'verbose'];
  let resolvedLevel = level;
  
  // Map common aliases
  if (level === 'warning') {
    resolvedLevel = 'warn';
  } else if (!logger[level] || typeof logger[level] !== 'function') {
    // Fallback to 'info' if level is invalid
    resolvedLevel = 'info';
  }
  
  if (process.env.SENTRY_DSN) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setContext(key, context[key]);
      });
      Sentry.captureMessage(message, resolvedLevel);
    });
  }
  logger[resolvedLevel](message, context);
};

// Set user context for Sentry
const setUserContext = (user) => {
  if (process.env.SENTRY_DSN && user) {
    Sentry.setUser({
      id: user.id,
      email: user.email,
    });
  }
};

// Clear user context
const clearUserContext = () => {
  if (process.env.SENTRY_DSN) {
    Sentry.setUser(null);
  }
};

module.exports = {
  initializeSentry,
  captureException,
  captureMessage,
  setUserContext,
  clearUserContext,
  Sentry, // Export Sentry for direct use if needed
};
