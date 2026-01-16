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

router.get('/:id', authenticateToken, getUserProfile);

module.exports = router;
