// Search routes
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
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
} = require('../controllers/searchController');

/**
 * @swagger
 * /api/search/users:
 *   get:
 *     summary: Search users/people
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
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: specialization
 *         schema:
 *           type: string
 *         description: Filter by specialization
 *       - in: query
 *         name: current_role
 *         schema:
 *           type: string
 *         description: Filter by current role
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
 * /api/search/organizations:
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
 *       - in: query
 *         name: organization_type
 *         schema:
 *           type: string
 *         description: Filter by organization type
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: specialty
 *         schema:
 *           type: string
 *         description: Filter by specialty
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/organizations', authenticateToken, searchOrganizations);

/**
 * @swagger
 * /api/search/colleges:
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
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *       - in: query
 *         name: institution_type
 *         schema:
 *           type: string
 *         description: Filter by institution type
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/colleges', authenticateToken, searchColleges);

/**
 * @swagger
 * /api/search/groups:
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
 *       - in: query
 *         name: group_type
 *         schema:
 *           type: string
 *         description: Filter by group type
 *       - in: query
 *         name: specialty
 *         schema:
 *           type: string
 *         description: Filter by specialty
 *       - in: query
 *         name: location
 *         schema:
 *           type: string
 *         description: Filter by location
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/groups', authenticateToken, searchGroups);

/**
 * @swagger
 * /api/search/hashtags:
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
router.get('/hashtags', authenticateToken, searchHashtags);

/**
 * @swagger
 * /api/search/autocomplete:
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
 *       - in: query
 *         name: limit_per_type
 *         schema:
 *           type: integer
 *           default: 5
 *         description: Number of results per type
 *     responses:
 *       200:
 *         description: Autocomplete suggestions
 */
router.get('/autocomplete', authenticateToken, autocomplete);

/**
 * @swagger
 * /api/search:
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
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *         description: Filter by types (comma-separated: people,companies,colleges,groups,topics,posts,jobs)
 *     responses:
 *       200:
 *         description: Search results
 */
router.get('/', authenticateToken, universalSearch);

module.exports = router;
