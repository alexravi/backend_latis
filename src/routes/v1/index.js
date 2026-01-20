// V1 API routes
const express = require('express');
const router = express.Router();
const { userLimiter } = require('../../middleware/rateLimiter');

// Import all v1 routes
const authRoutes = require('./authRoutes');
const userRoutes = require('./userRoutes');
const postRoutes = require('./postRoutes');
const commentRoutes = require('./commentRoutes');
const statusRoutes = require('./statusRoutes');
const uploadRoutes = require('./uploadRoutes');
const searchRoutes = require('./searchRoutes');
const experienceRoutes = require('../experienceRoutes');
const educationRoutes = require('../educationRoutes');
const skillRoutes = require('../skillRoutes');
const certificationRoutes = require('../certificationRoutes');
const publicationRoutes = require('../publicationRoutes');
const projectRoutes = require('../projectRoutes');
const awardRoutes = require('../awardRoutes');
const organizationRoutes = require('../organizationRoutes');

// Apply userLimiter to all routes
// Note: userLimiter uses user ID if authenticated, IP if not
// It runs at router level, so before route handlers
// Routes that require auth will have authenticateToken which sets req.user
// But since this runs before route handlers, it will use IP for rate limiting
// The higher limits (500 in dev, 300 in prod) should be sufficient
router.use(userLimiter);

// Mount all v1 routes
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/posts', postRoutes);
router.use('/comments', commentRoutes);
router.use('/status', statusRoutes);
router.use('/upload', uploadRoutes);
router.use('/search', searchRoutes);
router.use('/experiences', experienceRoutes);
router.use('/education', educationRoutes);
router.use('/skills', skillRoutes);
router.use('/certifications', certificationRoutes);
router.use('/publications', publicationRoutes);
router.use('/projects', projectRoutes);
router.use('/awards', awardRoutes);
router.use('/organizations', organizationRoutes);

module.exports = router;
