// User routes - Profile management
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const {
  getMyProfile,
  getUserProfile,
  updateMyProfile,
  updateExtendedProfile,
  createProfile,
  createCompleteProfile,
  getCompleteProfile,
  updateCompleteProfile,
  validateProfileUpdate,
  sendConnectionRequest,
  acceptConnectionRequest,
  declineConnectionRequest,
  removeConnectionHandler,
  listMyConnections,
  listIncomingConnectionRequests,
  listOutgoingConnectionRequests,
  followUser,
  unfollowUser,
  listFollowers,
  listFollowing,
  blockUserHandler,
  unblockUserHandler,
  listBlockedUsers,
} = require('../controllers/userController');

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 user:
 *                   type: object
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me', authenticateToken, getMyProfile);

/**
 * @swagger
 * /api/users/me:
 *   put:
 *     summary: Update current user's profile
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               first_name:
 *                 type: string
 *               last_name:
 *                 type: string
 *               headline:
 *                 type: string
 *               summary:
 *                 type: string
 *               location:
 *                 type: string
 *               phone:
 *                 type: string
 *               website:
 *                 type: string
 *               current_role:
 *                 type: string
 *               specialization:
 *                 type: string
 *               subspecialization:
 *                 type: string
 *               years_of_experience:
 *                 type: integer
 *               medical_school_graduation_year:
 *                 type: integer
 *               residency_completion_year:
 *                 type: integer
 *               fellowship_completion_year:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/me', authenticateToken, validateProfileUpdate, updateMyProfile);

/**
 * @swagger
 * /api/users/me/profile:
 *   put:
 *     summary: Update extended profile (bio, languages, interests, etc.)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               bio:
 *                 type: string
 *               languages:
 *                 type: array
 *                 items:
 *                   type: string
 *               interests:
 *                 type: array
 *                 items:
 *                   type: string
 *               causes:
 *                 type: array
 *                 items:
 *                   type: string
 *               volunteer_experiences:
 *                 type: object
 *     responses:
 *       200:
 *         description: Extended profile updated successfully
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/me/profile', authenticateToken, updateExtendedProfile);

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: Get user profile by ID
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: User ID
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *       403:
 *         description: Profile is private
 *       404:
 *         description: User not found
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /api/users/me/profile:
 *   post:
 *     summary: Create/Initialize profile after signup
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *                 properties:
 *                   first_name:
 *                     type: string
 *                   last_name:
 *                     type: string
 *                   headline:
 *                     type: string
 *               profile:
 *                 type: object
 *                 properties:
 *                   bio:
 *                     type: string
 *                   languages:
 *                     type: array
 *                     items:
 *                       type: string
 *     responses:
 *       201:
 *         description: Profile created successfully
 *       409:
 *         description: Profile already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/me/profile', authenticateToken, validateProfileUpdate, createProfile);

/**
 * @swagger
 * /api/users/me/profile/complete:
 *   post:
 *     summary: Create complete profile with all professional data (initial creation)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *               profile:
 *                 type: object
 *               experiences:
 *                 type: array
 *               education:
 *                 type: array
 *               skills:
 *                 type: array
 *               certifications:
 *                 type: array
 *               publications:
 *                 type: array
 *               projects:
 *                 type: array
 *               awards:
 *                 type: array
 *     responses:
 *       201:
 *         description: Complete profile created successfully
 *       409:
 *         description: Profile already exists
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/me/profile/complete', authenticateToken, createCompleteProfile);

/**
 * @swagger
 * /api/users/me/profile/complete:
 *   get:
 *     summary: Get complete profile with all professional data
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Complete profile retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/me/profile/complete', authenticateToken, getCompleteProfile);

/**
 * @swagger
 * /api/users/me/profile/complete:
 *   put:
 *     summary: Update complete profile (all fields in single request)
 *     tags: [Users]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               user:
 *                 type: object
 *               profile:
 *                 type: object
 *               experiences:
 *                 type: array
 *               education:
 *                 type: array
 *               skills:
 *                 type: array
 *               certifications:
 *                 type: array
 *               publications:
 *                 type: array
 *               projects:
 *                 type: array
 *               awards:
 *                 type: array
 *     responses:
 *       200:
 *         description: Complete profile updated successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/me/profile/complete', authenticateToken, updateCompleteProfile);

/**
 * @swagger
 * /api/users/{id}/connect:
 *   post:
 *     summary: Send a connection request to a user
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       201:
 *         description: Connection request sent
 *       400:
 *         description: Invalid request or already connected
 *       403:
 *         description: Block prevents this action
 *       404:
 *         description: Target user not found
 */
router.post('/:id/connect', authenticateToken, sendConnectionRequest);

/**
 * @swagger
 * /api/users/{id}/connect/accept:
 *   post:
 *     summary: Accept a pending connection request from a user
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Requester user ID
 *     responses:
 *       200:
 *         description: Connection request accepted
 *       403:
 *         description: Block prevents this action
 *       404:
 *         description: No pending request from this user
 */
router.post('/:id/connect/accept', authenticateToken, acceptConnectionRequest);

/**
 * @swagger
 * /api/users/{id}/connect/decline:
 *   post:
 *     summary: Decline a pending connection request from a user
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Requester user ID
 *     responses:
 *       200:
 *         description: Connection request declined
 *       404:
 *         description: No pending request from this user
 */
router.post('/:id/connect/decline', authenticateToken, declineConnectionRequest);

/**
 * @swagger
 * /api/users/{id}/connect:
 *   delete:
 *     summary: Remove an existing connection or cancel an outgoing request
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Other user ID
 *     responses:
 *       200:
 *         description: Connection removed or request cancelled
 *       403:
 *         description: Not allowed to cancel this request
 *       404:
 *         description: No connection or request found
 */
router.delete('/:id/connect', authenticateToken, removeConnectionHandler);

/**
 * @swagger
 * /api/users/me/connections:
 *   get:
 *     summary: List current user's connections
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [connected, pending]
 *           default: connected
 *         description: Filter by connection status
 *     responses:
 *       200:
 *         description: List of connections
 */
router.get('/me/connections', authenticateToken, listMyConnections);

/**
 * @swagger
 * /api/users/me/connection-requests/incoming:
 *   get:
 *     summary: List incoming connection requests
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of incoming connection requests
 */
router.get('/me/connection-requests/incoming', authenticateToken, listIncomingConnectionRequests);

/**
 * @swagger
 * /api/users/me/connection-requests/outgoing:
 *   get:
 *     summary: List outgoing connection requests
 *     tags: [Connections]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: List of outgoing connection requests
 */
router.get('/me/connection-requests/outgoing', authenticateToken, listOutgoingConnectionRequests);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   post:
 *     summary: Follow a user
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       201:
 *         description: Now following user
 *       400:
 *         description: Invalid request
 *       403:
 *         description: Block prevents this action
 *       404:
 *         description: Target user not found
 */
router.post('/:id/follow', authenticateToken, followUser);

/**
 * @swagger
 * /api/users/{id}/follow:
 *   delete:
 *     summary: Unfollow a user
 *     tags: [Follows]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       200:
 *         description: Unfollowed user
 *       404:
 *         description: Target user not found
 */
router.delete('/:id/follow', authenticateToken, unfollowUser);

/**
 * @swagger
 * /api/users/{id}/followers:
 *   get:
 *     summary: List followers of a user
 *     tags: [Follows]
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
 *     responses:
 *       200:
 *         description: List of followers
 */
router.get('/:id/followers', authenticateToken, listFollowers);

/**
 * @swagger
 * /api/users/{id}/following:
 *   get:
 *     summary: List users that a user is following
 *     tags: [Follows]
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
 *     responses:
 *       200:
 *         description: List of following users
 */
router.get('/:id/following', authenticateToken, listFollowing);

/**
 * @swagger
 * /api/users/{id}/block:
 *   post:
 *     summary: Block a user (hard block)
 *     tags: [Blocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       200:
 *         description: User blocked successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Target user not found
 */
router.post('/:id/block', authenticateToken, blockUserHandler);

/**
 * @swagger
 * /api/users/{id}/block:
 *   delete:
 *     summary: Unblock a user
 *     tags: [Blocks]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Target user ID
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       404:
 *         description: Target user not found
 */
router.delete('/:id/block', authenticateToken, unblockUserHandler);

/**
 * @swagger
 * /api/users/me/blocks:
 *   get:
 *     summary: List users that the current user has blocked
 *     tags: [Blocks]
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
 *     responses:
 *       200:
 *         description: List of blocked users
 */
router.get('/me/blocks', authenticateToken, listBlockedUsers);

router.get('/:id', authenticateToken, getUserProfile);

module.exports = router;
