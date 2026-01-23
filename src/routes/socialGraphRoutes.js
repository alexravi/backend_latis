// Social Graph routes - Social graph insights and analytics
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getMutualConnections,
  getMyNetworkStats,
  getUserNetworkStats,
  getSuggestedConnections,
  getRelationshipPath,
  getSecondDegreeConnections,
  getProfileVisitors,
  getVisitedProfiles,
  getVisitStats,
} = require('../controllers/socialGraphController');

/**
 * @swagger
 * /api/social-graph/mutual-connections/{userId}:
 *   get:
 *     summary: Get mutual connections between current user and target user
 *     description: Get users that both the current user and target user are connected to
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       200:
 *         description: Mutual connections retrieved successfully
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
router.get('/mutual-connections/:userId', authenticateToken, getMutualConnections);

/**
 * @swagger
 * /api/social-graph/network-stats:
 *   get:
 *     summary: Get network statistics for current user
 *     description: Get connection and follow statistics for the authenticated user
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Network statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/network-stats', authenticateToken, getMyNetworkStats);

/**
 * @swagger
 * /api/social-graph/network-stats/{userId}:
 *   get:
 *     summary: Get network statistics for a specific user
 *     description: Get connection and follow statistics for a specific user
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: Network statistics retrieved successfully
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
router.get('/network-stats/:userId', authenticateToken, getUserNetworkStats);

/**
 * @swagger
 * /api/social-graph/suggestions:
 *   get:
 *     summary: Get suggested connections (people you may know)
 *     description: Get suggested users to connect with based on mutual connections and second-degree connections
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of suggestions to return
 *     responses:
 *       200:
 *         description: Suggested connections retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/suggestions', authenticateToken, getSuggestedConnections);

/**
 * @swagger
 * /api/social-graph/relationship-path/{userId}:
 *   get:
 *     summary: Get relationship path/degrees of separation
 *     description: Get the shortest connection path between current user and target user (up to 2 degrees)
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       200:
 *         description: Relationship path retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       403:
 *         description: Blocked relationship prevents viewing
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/relationship-path/:userId', authenticateToken, getRelationshipPath);

/**
 * @swagger
 * /api/social-graph/second-degree/{userId}:
 *   get:
 *     summary: Get second-degree connections (friends of friends)
 *     description: Get users connected to the target user's connections
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of connections to return
 *     responses:
 *       200:
 *         description: Second-degree connections retrieved successfully
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
router.get('/second-degree/:userId', authenticateToken, getSecondDegreeConnections);

/**
 * @swagger
 * /api/social-graph/profile-visitors/{userId}:
 *   get:
 *     summary: Get profile visitors for a user
 *     description: Get users who have viewed the specified user's profile (only own profile for now)
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID (must be current user)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of visitors to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of visitors to skip
 *     responses:
 *       200:
 *         description: Profile visitors retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       403:
 *         description: Not authorized to view visitors or blocked relationship
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/profile-visitors/:userId', authenticateToken, getProfileVisitors);

/**
 * @swagger
 * /api/social-graph/visited-profiles:
 *   get:
 *     summary: Get profiles current user has visited
 *     description: Get list of profiles the authenticated user has viewed
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of profiles to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of profiles to skip
 *     responses:
 *       200:
 *         description: Visited profiles retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/visited-profiles', authenticateToken, getVisitedProfiles);

/**
 * @swagger
 * /api/social-graph/visit-stats/{userId}:
 *   get:
 *     summary: Get visit statistics for a profile
 *     description: Get total visits and unique visitor count for a profile (only own profile for now)
 *     tags: [Social Graph]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID (must be current user)
 *     responses:
 *       200:
 *         description: Visit statistics retrieved successfully
 *       400:
 *         description: Invalid user ID
 *       403:
 *         description: Not authorized to view stats or blocked relationship
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/visit-stats/:userId', authenticateToken, getVisitStats);

module.exports = router;
