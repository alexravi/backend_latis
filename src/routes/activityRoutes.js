// Activity routes - Activity feed management
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getActivityFeed,
  getMyActivities,
  getUserActivities,
  getActivities,
} = require('../controllers/activityController');

/**
 * @swagger
 * /api/activities/feed:
 *   get:
 *     summary: Get activity feed (activities from connections/following)
 *     description: Get activities from users you follow or are connected to
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of activities to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of activities to skip
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [post_created, comment_created, comment_replied, reaction_added, follow, connection_requested, connection_accepted, profile_updated]
 *         description: Filter by activity type
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter activities from this date onwards
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Filter activities up to this date
 *     responses:
 *       200:
 *         description: Activity feed retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Activity'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                     offset:
 *                       type: integer
 *                     count:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/feed', authenticateToken, getActivityFeed);

/**
 * @swagger
 * /api/activities/me:
 *   get:
 *     summary: Get current user's own activities
 *     description: Get activities performed by the authenticated user
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [post_created, comment_created, comment_replied, reaction_added, follow, connection_requested, connection_accepted, profile_updated]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: User activities retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me', authenticateToken, getMyActivities);

/**
 * @swagger
 * /api/activities/user/{id}:
 *   get:
 *     summary: Get activities for a specific user
 *     description: Get activities performed by a specific user
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [post_created, comment_created, comment_replied, reaction_added, follow, connection_requested, connection_accepted, profile_updated]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: User activities retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       403:
 *         description: Blocked relationship prevents viewing
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/user/:id', authenticateToken, getUserActivities);

/**
 * @swagger
 * /api/activities:
 *   get:
 *     summary: Get activities with filtering
 *     description: Get activities with optional filtering. Use feed=true for feed activities, otherwise own activities.
 *     tags: [Activities]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: feed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: If true, return feed activities (from connections/following), otherwise own activities
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [post_created, comment_created, comment_replied, reaction_added, follow, connection_requested, connection_accepted, profile_updated]
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/', authenticateToken, getActivities);

module.exports = router;
