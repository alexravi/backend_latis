// Search routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/authMiddleware');
const {
  searchUsers,
  searchPosts,
  searchJobs,
  searchOrganizations,
  searchColleges,
  searchGroups,
  searchHashtags,
  autocomplete,
  universalSearch,
} = require('../../controllers/searchController');

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Search users
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/users', authenticateToken, searchUsers);

/**
 * @swagger
 * /api/search/posts:
 *   get:
 *     summary: Search posts
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/posts', authenticateToken, searchPosts);

/**
 * @swagger
 * /api/search/jobs:
 *   get:
 *     summary: Search job postings
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/jobs', authenticateToken, searchJobs);

/**
 * @swagger
 * /api/v1/search/organizations:
 *   get:
 *     summary: Search organizations/companies
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/organizations', authenticateToken, searchOrganizations);

/**
 * @swagger
 * /api/v1/search/colleges:
 *   get:
 *     summary: Search colleges/universities
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/colleges', authenticateToken, searchColleges);

/**
 * @swagger
 * /api/v1/search/groups:
 *   get:
 *     summary: Search groups
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/groups', authenticateToken, searchGroups);

/**
 * @swagger
 * /api/v1/search/hashtags:
 *   get:
 *     summary: Search hashtags/topics
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/hashtags', authenticateToken, searchHashtags);

/**
 * @swagger
 * /api/v1/search/autocomplete:
 *   get:
 *     summary: Autocomplete search suggestions
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
 */
router.get('/autocomplete', authenticateToken, autocomplete);

/**
 * @swagger
 * /api/v1/search:
 *   get:
 *     summary: Universal search (all types)
 *     tags: [Search]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: Search query
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by types (comma-separated)
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/', authenticateToken, universalSearch);

module.exports = router;
