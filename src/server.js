// Express app setup and configuration
// This file contains the Express application setup, middleware, and route configuration
// Swagger documentation will be configured here
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const { swaggerSpec, swaggerUi } = require('./config/swagger');
const { generalLimiter, userLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/requestLogger');
const { errorHandler, notFoundHandler } = require('./middleware/errorMiddleware');
const { initializeSentry } = require('./utils/errorHandler');
const { authenticateToken } = require('./middleware/authMiddleware');
const logger = require('./utils/logger');

// Initialize Sentry before creating Express app
initializeSentry();

const app = express();

// Security headers with Helmet
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"], // Allow inline scripts for Swagger UI
      imgSrc: ["'self'", 'data:', 'https:', 'http:'],
      connectSrc: ["'self'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for Swagger UI compatibility
}));

// Response compression (gzip/brotli)
app.use(compression({
  level: 6, // Compression level (1-9, 6 is a good balance)
  filter: (req, res) => {
    // Don't compress responses if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression filter function
    return compression.filter(req, res);
  },
}));

// CORS configuration
const allowedOrigins = [
  'http://localhost:5173',
  'https://latis.in',
  'https://weblatis-hkfhcee7ctesdpek.centralindia-01.azurewebsites.net'
];

// Add additional origins from environment variable (comma-separated)
if (process.env.ALLOWED_ORIGINS) {
  const additionalOrigins = process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
  allowedOrigins.push(...additionalOrigins);
}

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, Postman, etc.)
    if (!origin) return callback(null, true);
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow Azure frontend subdomains for flexibility
    if (origin.match(/^https:\/\/weblatis-[a-z0-9]+\.centralindia-01\.azurewebsites\.net$/)) {
      return callback(null, true);
    }
    
    return callback(new Error('CORS blocked'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['RateLimit-Limit', 'RateLimit-Remaining', 'RateLimit-Reset'],
  maxAge: 86400, // 24 hours
}));

app.options('*', cors());

// Request logging middleware (should be early in the chain)
app.use(requestLogger);

// Rate limiting - apply general limiter to unauthenticated routes only
// (authenticated routes will use userLimiter applied after authentication)
app.use(generalLimiter);

// Middleware
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded payload size

// Serve uploaded files with authentication check
// Note: In production, consider using signed URLs or a CDN instead
app.use('/uploads', authenticateToken, express.static('uploads'));

// Swagger documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Swagger JSON endpoint for downloading the spec
app.get('/api-docs.json', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// Routes - V1 API
const v1Routes = require('./routes/v1');

// Legacy routes (for backward compatibility - will be deprecated)
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const experienceRoutes = require('./routes/experienceRoutes');
const educationRoutes = require('./routes/educationRoutes');
const skillRoutes = require('./routes/skillRoutes');
const certificationRoutes = require('./routes/certificationRoutes');
const publicationRoutes = require('./routes/publicationRoutes');
const projectRoutes = require('./routes/projectRoutes');
const awardRoutes = require('./routes/awardRoutes');
const organizationRoutes = require('./routes/organizationRoutes');
const postRoutes = require('./routes/postRoutes');
const commentRoutes = require('./routes/commentRoutes');
const statusRoutes = require('./routes/statusRoutes');
const uploadRoutes = require('./routes/uploadRoutes');
const searchRoutes = require('./routes/searchRoutes');
const messageRoutes = require('./routes/messageRoutes');
const activityRoutes = require('./routes/activityRoutes');
const socialGraphRoutes = require('./routes/socialGraphRoutes');

// V1 API routes (versioned)
// userLimiter is applied within v1Routes router (after authentication in route handlers)
app.use('/api/v1', v1Routes);

// Legacy routes (for backward compatibility - redirects to v1)
// These will be deprecated in the future
// userLimiter uses user ID if authenticated, IP if not
// It's applied at app level, so it runs before route handlers
// Routes that require auth will have authenticateToken which sets req.user
// But since userLimiter runs before route handlers, it will use IP for rate limiting
// This is acceptable - the higher limits (500 in dev, 300 in prod) should be sufficient
app.use('/api/users', userLimiter, userRoutes);
app.use('/api/experiences', userLimiter, experienceRoutes);
app.use('/api/education', userLimiter, educationRoutes);
app.use('/api/skills', userLimiter, skillRoutes);
app.use('/api/certifications', userLimiter, certificationRoutes);
app.use('/api/publications', userLimiter, publicationRoutes);
app.use('/api/projects', userLimiter, projectRoutes);
app.use('/api/awards', userLimiter, awardRoutes);
app.use('/api/organizations', userLimiter, organizationRoutes);
app.use('/api/posts', userLimiter, postRoutes);
app.use('/api/comments', userLimiter, commentRoutes);
app.use('/api/upload', userLimiter, uploadRoutes);
app.use('/api/search', userLimiter, searchRoutes);
app.use('/api/messages', userLimiter, messageRoutes);
app.use('/api/activities', userLimiter, activityRoutes);
app.use('/api/social-graph', userLimiter, socialGraphRoutes);

// Auth routes use authLimiter (applied in route file)
app.use('/api/auth', authRoutes);

// Status routes are unauthenticated, use generalLimiter only (already applied globally)
app.use('/api/status', statusRoutes);

// 404 handler (must be before error handler)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
